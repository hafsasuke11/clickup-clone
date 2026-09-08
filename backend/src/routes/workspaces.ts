import { Router } from 'express';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { WorkspaceInvite } from '../models/WorkspaceInvite.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { AuditLog } from '../models/AuditLog.js';
import { TaskActivity } from '../models/TaskActivity.js';
import { toPublicUser, findUserById } from '../services/userService.js';
import { requireWorkspaceMember } from '../middleware/requireWorkspaceMember.js';
import { requirePermission, requireOwner } from '../middleware/requirePermission.js';
import {
  ALL_PERMISSIONS, PERMISSION_KEYS, effectivePermissions, normalizePermissions,
} from '../services/permissions.js';
import { sendInviteEmail, buildInviteUrl, isEmailConfigured } from '../services/emailService.js';
import { logActivity } from '../services/auditService.js';
import projectRoutes from './projects.js';
import taskRoutes from './tasks.js';
import statusRoutes from './statuses.js';

const router = Router();

router.get('/', async (req, res) => {
  const workspaces = await Workspace.find({ 'members.userId': req.userId }).sort({ createdAt: 1 });
  res.json({ workspaces });
});

router.post('/', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Workspace name is required.' });
  }

  const workspace = await Workspace.create({
    name: name.trim(),
    ownerId: req.userId,
    members: [{ userId: req.userId, role: 'owner' }],
  });
  res.status(201).json({ workspace });
});

router.get('/:workspaceId', requireWorkspaceMember, async (req, res) => {
  const workspace = await Workspace.findById(req.params.workspaceId);
  res.json({ workspace });
});

router.patch('/:workspaceId', requireWorkspaceMember, requireOwner('rename this workspace'), async (req, res) => {

  const { name } = req.body ?? {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Workspace name is required.' });
  }

  const before = await Workspace.findById(req.params.workspaceId);
  const workspace = await Workspace.findByIdAndUpdate(
    req.params.workspaceId,
    { name: name.trim() },
    { new: true },
  );
  if (before && workspace && before.name !== workspace.name) {
    logActivity({
      workspaceId: String(req.params.workspaceId),
      actorId: req.userId!,
      action: 'workspace_renamed',
      meta: { oldName: before.name, newName: workspace.name },
    });
  }
  res.json({ workspace });
});

router.get('/:workspaceId/members', requireWorkspaceMember, async (req, res) => {
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const users = await User.find({ _id: { $in: workspace.members.map((m) => m.userId) } });
  const usersById = new Map(users.map((u) => [String(u._id), u]));

  const members = workspace.members.map((m) => {
    const user = usersById.get(String(m.userId));
    return {
      userId: String(m.userId),
      role: m.role === 'owner' ? 'owner' : 'member',
      joinedAt: m.joinedAt,
      // Raw grants (for the owner's permission grid) plus the effective set the
      // member actually operates with.
      permissions: normalizePermissions(m.permissions),
      effectivePermissions: effectivePermissions(m),
      user: user ? toPublicUser(user) : null,
    };
  });

  res.json({ members });
});

router.post('/:workspaceId/members', requireWorkspaceMember, requirePermission('manageMembers'), async (req, res) => {
  const { email } = req.body ?? {};
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  const assignedRole = 'member' as const;

  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const inviter = await findUserById(req.userId!);
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser && workspace.members.some((m) => String(m.userId) === String(existingUser._id))) {
    return res.status(409).json({ error: 'That person is already a member of this workspace.' });
  }

  // Everyone is invited, never force-added. The invited person accepts the
  // invite themselves (from the emailed / shared link) before they join.
  let invite = await WorkspaceInvite.findOne({ workspaceId: workspace._id, email: normalizedEmail });
  const resent = Boolean(invite);
  if (invite) {
    invite.role = assignedRole;
    invite.invitedBy = req.userId as unknown as typeof invite.invitedBy;
    invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await invite.save();
  } else {
    invite = await WorkspaceInvite.create({
      workspaceId: workspace._id,
      email: normalizedEmail,
      role: assignedRole,
      invitedBy: req.userId,
    });
  }

  // Fire-and-forget: a slow or failing SMTP send must never hold up the
  // response. The copy-able invite link below is the reliable delivery path.
  void sendInviteEmail({
    to: normalizedEmail,
    workspaceName: workspace.name,
    inviterName: inviter?.fullName ?? 'Someone',
    token: invite.token,
  }).catch((err) => console.error('sendInviteEmail failed:', err));

  logActivity({
    workspaceId: workspace.id,
    actorId: req.userId!,
    action: 'member_invited',
    meta: { email: normalizedEmail, role: assignedRole, resent },
  });

  res.status(202).json({
    status: 'invited',
    emailSent: isEmailConfigured(),
    invite: {
      email: normalizedEmail,
      role: assignedRole,
      token: invite.token,
      inviteUrl: buildInviteUrl(invite.token),
    },
  });
});

router.get('/:workspaceId/invites', requireWorkspaceMember, requirePermission('manageMembers'), async (req, res) => {
  const invites = await WorkspaceInvite.find({ workspaceId: req.params.workspaceId }).sort({ createdAt: -1 });
  res.json({
    invites: invites.map((inv) => ({ ...inv.toJSON(), inviteUrl: buildInviteUrl(inv.token) })),
  });
});

router.delete('/:workspaceId/invites/:inviteId', requireWorkspaceMember, requirePermission('manageMembers'), async (req, res) => {
  const invite = await WorkspaceInvite.findOneAndDelete({ _id: req.params.inviteId, workspaceId: req.params.workspaceId });
  if (invite) {
    logActivity({
      workspaceId: String(req.params.workspaceId),
      actorId: req.userId!,
      action: 'invite_revoked',
      meta: { email: invite.email },
    });
  }
  res.status(204).end();
});

router.get('/:workspaceId/activity', requireWorkspaceMember, requireOwner('view the workspace activity log'), async (req, res) => {
  const entries = await AuditLog.find({ workspaceId: req.params.workspaceId }).sort({ createdAt: -1 }).limit(50);
  const userIds = new Set<string>();
  entries.forEach((e) => {
    userIds.add(String(e.actorId));
    if (e.targetUserId) userIds.add(String(e.targetUserId));
  });
  const users = await User.find({ _id: { $in: [...userIds] } });
  const usersById = new Map(users.map((u) => [String(u._id), toPublicUser(u)]));

  const activity = entries.map((e) => ({
    id: String(e._id),
    action: e.action,
    meta: e.meta,
    createdAt: e.createdAt,
    actor: usersById.get(String(e.actorId)) ?? null,
    target: e.targetUserId ? (usersById.get(String(e.targetUserId)) ?? null) : null,
  }));

  res.json({ activity });
});

router.delete('/:workspaceId/activity', requireWorkspaceMember, requireOwner('clear the workspace activity log'), async (req, res) => {
  await AuditLog.deleteMany({ workspaceId: req.params.workspaceId });
  res.status(204).end();
});

// Remove specific audit-log rows by id (used by the Activity page's row menu).
// A member may remove rows they are the actor of; the owner or someone with
// `manageMembers` may remove anyone's. Deletes only the log rows.
router.delete('/:workspaceId/activity/entries', requireWorkspaceMember, async (req, res) => {
  const raw = (req.body as { ids?: unknown })?.ids;
  const ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length === 0) return res.json({ deleted: 0, ids: [] });

  const canManageAny = req.workspaceRole === 'owner' || Boolean(req.workspacePermissions?.manageMembers);
  const filter: Record<string, unknown> = { workspaceId: req.params.workspaceId, _id: { $in: ids } };
  if (!canManageAny) filter.actorId = req.userId;

  const matched = await AuditLog.find(filter).select('_id');
  const matchedIds = matched.map((d) => String(d._id));
  if (matchedIds.length > 0) await AuditLog.deleteMany({ _id: { $in: matchedIds } });

  res.json({ deleted: matchedIds.length, ids: matchedIds });
});

// Per-member task activity — what each member added / updated / completed /
// changed. Visible to every workspace member (unlike the members-only audit log
// above), optionally scoped to one project or one member.
router.get('/:workspaceId/task-activity', requireWorkspaceMember, async (req, res) => {
  const filter: Record<string, unknown> = { workspaceId: req.params.workspaceId };
  if (req.query.projectId === 'none') filter.projectId = null;
  else if (req.query.projectId) filter.projectId = req.query.projectId;
  if (req.query.actorId) filter.actorId = req.query.actorId;

  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const entries = await TaskActivity.find(filter).sort({ createdAt: -1 }).limit(limit);

  const actorIds = [...new Set(entries.map((e) => String(e.actorId)))];
  const users = await User.find({ _id: { $in: actorIds } });
  const usersById = new Map(users.map((u) => [String(u._id), toPublicUser(u)]));

  const activity = entries.map((e) => ({
    id: String(e._id),
    action: e.action,
    taskId: e.taskId ? String(e.taskId) : null,
    taskName: e.taskName,
    projectId: e.projectId ? String(e.projectId) : null,
    meta: e.meta,
    createdAt: e.createdAt,
    actor: usersById.get(String(e.actorId)) ?? null,
  }));

  res.json({ activity });
});

// The whole-workspace activity timeline: task activity + the audit log (project,
// status, member, permission and workspace changes), merged and newest-first.
// Visible to every member — this is the app-wide "what happened" feed.
router.get('/:workspaceId/overall-activity', requireWorkspaceMember, async (req, res) => {
  const { workspaceId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 400, 1000);

  const [auditEntries, taskEntries] = await Promise.all([
    AuditLog.find({ workspaceId }).sort({ createdAt: -1 }).limit(limit),
    TaskActivity.find({ workspaceId }).sort({ createdAt: -1 }).limit(limit),
  ]);

  const userIds = new Set<string>();
  auditEntries.forEach((e) => {
    userIds.add(String(e.actorId));
    if (e.targetUserId) userIds.add(String(e.targetUserId));
  });
  taskEntries.forEach((e) => userIds.add(String(e.actorId)));

  const users = await User.find({ _id: { $in: [...userIds] } });
  const usersById = new Map(users.map((u) => [String(u._id), toPublicUser(u)]));

  const audit = auditEntries.map((e) => ({
    id: String(e._id),
    source: 'audit' as const,
    action: e.action,
    actor: usersById.get(String(e.actorId)) ?? null,
    target: e.targetUserId ? (usersById.get(String(e.targetUserId)) ?? null) : null,
    meta: e.meta ?? {},
    createdAt: e.createdAt,
  }));

  const task = taskEntries.map((e) => ({
    id: String(e._id),
    source: 'task' as const,
    action: e.action,
    actor: usersById.get(String(e.actorId)) ?? null,
    taskId: e.taskId ? String(e.taskId) : null,
    taskName: e.taskName,
    projectId: e.projectId ? String(e.projectId) : null,
    meta: e.meta ?? {},
    createdAt: e.createdAt,
  }));

  const activity = [...audit, ...task]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  res.json({ activity });
});

// Remove specific activity-feed rows by id. This deletes only the activity
// records — never the tasks or projects that produced them. A member may remove
// their own rows; `manageProjects` lets them remove anyone's.
router.delete('/:workspaceId/task-activity/entries', requireWorkspaceMember, async (req, res) => {
  const raw = (req.body as { ids?: unknown })?.ids;
  const ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length === 0) return res.json({ deleted: 0, ids: [] });

  const filter: Record<string, unknown> = {
    workspaceId: req.params.workspaceId,
    _id: { $in: ids },
  };
  if (!req.workspacePermissions?.manageProjects) filter.actorId = req.userId;

  const matched = await TaskActivity.find(filter).select('_id');
  const matchedIds = matched.map((d) => String(d._id));
  if (matchedIds.length > 0) await TaskActivity.deleteMany({ _id: { $in: matchedIds } });

  res.json({ deleted: matchedIds.length, ids: matchedIds });
});

// Clear task activity — for one project (`?projectId=`), the "no project"
// bucket (`?projectId=none`), or the whole workspace.
router.delete('/:workspaceId/task-activity', requireWorkspaceMember, requirePermission('manageProjects'), async (req, res) => {
  const filter: Record<string, unknown> = { workspaceId: req.params.workspaceId };
  if (req.query.projectId === 'none') filter.projectId = null;
  else if (req.query.projectId) filter.projectId = req.query.projectId;

  const { deletedCount } = await TaskActivity.deleteMany(filter);
  res.json({ deleted: deletedCount });
});

// Only the Owner can decide what a member is allowed to do.
router.patch(
  '/:workspaceId/members/:userId/permissions',
  requireWorkspaceMember,
  requireOwner('change member permissions'),
  async (req, res) => {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const member = workspace.members.find((m) => String(m.userId) === req.params.userId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (String(member.userId) === String(workspace.ownerId)) {
      return res.status(400).json({ error: 'The owner already has full access.' });
    }

    const before = normalizePermissions(member.permissions);
    // Accept a partial patch: only the keys present in the body change.
    const incoming = (req.body?.permissions ?? {}) as Record<string, unknown>;
    const next = { ...before };
    for (const k of PERMISSION_KEYS) {
      if (k in incoming) next[k] = incoming[k] === true;
    }
    member.set('permissions', next);
    await workspace.save();

    const granted = PERMISSION_KEYS.filter((k) => !before[k] && next[k]);
    const revoked = PERMISSION_KEYS.filter((k) => before[k] && !next[k]);
    if (granted.length || revoked.length) {
      logActivity({
        workspaceId: String(req.params.workspaceId),
        actorId: req.userId!,
        action: 'permissions_changed',
        targetUserId: String(req.params.userId),
        meta: { granted, revoked },
      });
    }

    res.json({
      member: {
        userId: String(member.userId),
        role: 'member',
        permissions: next,
        effectivePermissions: next,
      },
    });
  },
);

router.delete('/:workspaceId/members/:userId', requireWorkspaceMember, async (req, res) => {
  const isSelf = req.params.userId === req.userId;
  if (!isSelf && req.workspaceRole !== 'owner' && !req.workspacePermissions?.manageMembers) {
    return res.status(403).json({
      code: 'PERMISSION_DENIED',
      error: "You don't have permission to manage members. Ask the workspace owner to grant it.",
    });
  }

  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  if (req.params.userId === String(workspace.ownerId)) {
    return res.status(400).json({ error: "Can't remove the workspace owner." });
  }

  if (isSelf) {
    const otherWorkspaceCount = await Workspace.countDocuments({
      'members.userId': req.userId,
      _id: { $ne: req.params.workspaceId },
    });
    if (otherWorkspaceCount === 0) {
      return res.status(400).json({ error: "You can't leave your only workspace." });
    }
  }

  workspace.members = workspace.members.filter((m) => String(m.userId) !== req.params.userId) as typeof workspace.members;
  await workspace.save();

  logActivity({
    workspaceId: String(req.params.workspaceId),
    actorId: req.userId!,
    action: isSelf ? 'member_left' : 'member_removed',
    targetUserId: String(req.params.userId),
  });

  res.status(204).end();
});

router.post('/:workspaceId/transfer-ownership', requireWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'owner') {
    return res.status(403).json({ error: 'Only the workspace owner can transfer ownership.' });
  }

  const { newOwnerId } = req.body ?? {};
  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  if (newOwnerId === String(workspace.ownerId)) {
    return res.status(400).json({ error: 'That member is already the owner.' });
  }
  const newOwner = workspace.members.find((m) => String(m.userId) === newOwnerId);
  if (!newOwner) {
    return res.status(400).json({ error: 'That user is not a member of this workspace.' });
  }

  const oldOwnerId = String(workspace.ownerId);
  const oldOwnerMember = workspace.members.find((m) => String(m.userId) === oldOwnerId);
  if (oldOwnerMember) {
    oldOwnerMember.role = 'member';
    // Keep the former owner fully capable rather than locking them out.
    oldOwnerMember.set('permissions', { ...ALL_PERMISSIONS });
  }
  newOwner.role = 'owner';
  workspace.ownerId = newOwner.userId;
  await workspace.save();

  logActivity({
    workspaceId: String(req.params.workspaceId),
    actorId: req.userId!,
    action: 'ownership_transferred',
    targetUserId: newOwnerId,
    meta: { oldOwnerId },
  });

  res.json({ workspace });
});

router.delete('/:workspaceId', requireWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'owner') {
    return res.status(403).json({ error: 'Only the workspace owner can delete this workspace.' });
  }

  const otherWorkspaceCount = await Workspace.countDocuments({
    'members.userId': req.userId,
    _id: { $ne: req.params.workspaceId },
  });
  if (otherWorkspaceCount === 0) {
    return res.status(400).json({ error: "You can't delete your only workspace." });
  }

  const { workspaceId } = req.params;
  await Task.deleteMany({ workspaceId });
  await Project.deleteMany({ workspaceId });
  await WorkspaceInvite.deleteMany({ workspaceId });
  await AuditLog.deleteMany({ workspaceId });
  await Workspace.findByIdAndDelete(workspaceId);

  res.status(204).end();
});

router.use('/:workspaceId/projects', requireWorkspaceMember, projectRoutes);
router.use('/:workspaceId/tasks', requireWorkspaceMember, taskRoutes);
router.use('/:workspaceId/statuses', requireWorkspaceMember, statusRoutes);

export default router;
