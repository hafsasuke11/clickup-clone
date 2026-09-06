import { Router } from 'express';
import { WorkspaceInvite } from '../models/WorkspaceInvite.js';
import { Workspace } from '../models/Workspace.js';
import { findUserById } from '../services/userService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/:token', async (req, res) => {
  const invite = await WorkspaceInvite.findOne({ token: req.params.token });
  if (!invite || invite.expiresAt < new Date()) {
    return res.status(404).json({ error: 'This invite is invalid or has expired.' });
  }

  const workspace = await Workspace.findById(invite.workspaceId);
  if (!workspace) return res.status(404).json({ error: 'Workspace no longer exists.' });

  const inviter = await findUserById(String(invite.invitedBy));

  res.json({
    email: invite.email,
    role: invite.role,
    workspaceName: workspace.name,
    inviterName: inviter?.fullName ?? 'Someone',
  });
});

router.post('/:token/accept', requireAuth, async (req, res) => {
  const invite = await WorkspaceInvite.findOne({ token: req.params.token });
  if (!invite || invite.expiresAt < new Date()) {
    return res.status(404).json({ error: 'This invite is invalid or has expired.' });
  }

  const user = await findUserById(req.userId!);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return res.status(403).json({ error: 'This invite was sent to a different email address.' });
  }

  const workspace = await Workspace.findById(invite.workspaceId);
  if (!workspace) return res.status(404).json({ error: 'Workspace no longer exists.' });

  if (!workspace.members.some((m) => String(m.userId) === String(user._id))) {
    workspace.members.push({ userId: user._id, role: invite.role, joinedAt: new Date() });
    await workspace.save();
  }

  await WorkspaceInvite.deleteOne({ _id: invite._id });

  res.json({ workspace });
});

export default router;
