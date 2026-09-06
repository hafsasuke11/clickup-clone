import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  createUser,
  findUserByEmail,
  findUserById,
  toPublicUser,
  verifyPassword,
} from '../services/userService.js';
import { Workspace } from '../models/Workspace.js';
import { WorkspaceInvite } from '../models/WorkspaceInvite.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { JWT_SECRET } from '../config.js';

const router = Router();

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName, company, confirmPassword, inviteToken } = req.body ?? {};

    if (!email?.trim() || !password || !fullName?.trim()) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // If signing up via an invite link, the account email must match the invited email.
    let invite = null;
    if (inviteToken) {
      invite = await WorkspaceInvite.findOne({ token: inviteToken });
      if (!invite || invite.expiresAt < new Date()) {
        return res.status(404).json({ error: 'This invite is invalid or has expired.' });
      }
      if (invite.email.toLowerCase() !== email.trim().toLowerCase()) {
        return res.status(400).json({ error: 'This invite was sent to a different email address.' });
      }
    }

    const user = await createUser({ email, password, fullName, company });

    if (invite) {
      await Workspace.findByIdAndUpdate(invite.workspaceId, {
        $push: { members: { userId: user._id, role: invite.role, joinedAt: new Date() } },
      });
      await WorkspaceInvite.deleteOne({ _id: invite._id });
    } else {
      const firstName = user.fullName.split(' ')[0];
      await Workspace.create({
        name: `${firstName}'s Workspace`,
        ownerId: user._id,
        members: [{ userId: user._id, role: 'owner' }],
      });
    }

    const token = signToken(String(user._id));
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err: unknown) {
    const isDuplicateEmail =
      (err instanceof Error && err.message === 'EMAIL_EXISTS') ||
      (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000);
    if (isDuplicateEmail) {
      return res.status(409).json({ error: 'This email is already registered. Try logging in.' });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'No account found with that email. Please sign up first.' });
    }
    if (!(await verifyPassword(user, password))) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = signToken(String(user._id));
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await findUserById(req.userId!);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ user: toPublicUser(user) });
});

export default router;
