import { Router } from 'express';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { WorkspaceInvite } from '../models/WorkspaceInvite.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { AuditLog } from '../models/AuditLog.js';
import { toPublicUser, findUserById } from '../services/userService.js';
import { requireWorkspaceMember } from '../middleware/requireWorkspaceMember.js';
import { sendInviteEmail, buildInviteUrl, isEmailConfigured } from '../services/emailService.js';
import { logActivity } from '../services/auditService.js';
import projectRoutes from './projects.js';
import taskRoutes from './tasks.js';

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

router.patch('/:workspaceId', requireWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'owner' && req.workspaceRole !== 'admin') {
    return res.status(403).json({ error: 'Only owners and admins can rename this workspace.' });
  }

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
      role: m.role,
      joinedAt: m.joinedAt,
      user: user ? toPublicUser(user) : null,
    };
  });

  res.json({ members });
});

router.post('/:workspaceId/members', requireWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'owner' && req.workspaceRole !== 'admin') {
    return res.status(403).json({ error: 'Only owners and admins can invite members.' });
  }

  const { email, role } = req.body ?? {};
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  const assignedRole = role === 'admin' ? 'admin' : 'member';

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

router.get('/:workspaceId/invites', requireWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'owner' && req.workspaceRole !== 'admin') {
    return res.status(403).json({ error: 'Only owners and admins can view pending invites.' });
  }
  const invites = await WorkspaceInvite.find({ workspaceId: req.params.workspaceId }).sort({ createdAt: -1 });
  res.json({
    invites: invites.map((inv) => ({ ...inv.toJSON(), inviteUrl: buildInviteUrl(inv.token) })),
  });
});

router.delete('/:workspaceId/invites/:inviteId', requireWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'owner' && req.workspaceRole !== 'admin') {
    return res.status(403).json({ error: 'Only owners and admins can revoke invites.' });
  }
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

router.get('/:workspaceId/activity', requireWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'owner' && req.workspaceRole !== 'admin') {
    return res.status(403).json({ error: 'Only owners and admins can view activity.' });
  }

  const entries = await AuditLog.find({ workspaceId: req.params.workspaceId }).sort({ createdAt: -1 }).limit(30);
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

router.delete('/:workspaceId/activity', requireWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'owner' && req.workspaceRole !== 'admin') {
    return res.status(403).json({ error: 'Only owners and admins can clear activity.' });
  }
  await AuditLog.deleteMany({ workspaceId: req.params.workspaceId });
  res.status(204).end();
});

router.patch('/:workspaceId/members/:userId', requireWorkspaceMember, async (req, res) => {
  if (req.workspaceRole !== 'owner') {
    return res.status(403).json({ error: 'Only the workspace owner can change roles.' });
  }

  const { role } = req.body ?? {};
  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "admin" or "member".' });
  }

  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const member = workspace.members.find((m) => String(m.userId) === req.params.userId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (String(member.userId) === String(workspace.ownerId)) {
    return res.status(400).json({ error: "Can't change the owner's role." });
  }

  const oldRole = member.role;
  member.role = role;
  await workspace.save();

  if (oldRole !== role) {
    logActivity({
      workspaceId: String(req.params.workspaceId),
      actorId: req.userId!,
      action: 'role_changed',
      targetUserId: String(req.params.userId),
      meta: { oldRole, newRole: role },
    });
  }

  res.json({ member: { userId: String(member.userId), role: member.role } });
});

router.delete('/:workspaceId/members/:userId', requireWorkspaceMember, async (req, res) => {
  const isSelf = req.params.userId === req.userId;
  if (!isSelf && req.workspaceRole !== 'owner' && req.workspaceRole !== 'admin') {
    return res.status(403).json({ error: 'Only owners and admins can remove members.' });
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
  if (oldOwnerMember) oldOwnerMember.role = 'admin';
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

export default router;
