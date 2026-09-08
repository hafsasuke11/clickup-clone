import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  createUser,
  findUserByEmail,
  findUserById,
  toPublicUser,
  verifyPassword,
} from '../services/userService.js';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { WorkspaceInvite } from '../models/WorkspaceInvite.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { JWT_SECRET, IS_PRODUCTION } from '../config.js';
import { sendOtpEmail } from '../services/emailService.js';
import { issueOtp, verifyOtp, clearOtp, type VerifyResult } from '../services/emailOtpService.js';
import twoFactorRoutes from './twoFactor.js';

const router = Router();

/**
 * A distinct secret for the short-lived "password OK, 2FA still pending" token.
 * Because it is NOT `JWT_SECRET`, `requireAuth` cannot verify it — so this token
 * grants nothing on its own; it only lets the client call `/login/2fa`.
 */
const CHALLENGE_SECRET = crypto
  .createHash('sha256')
  .update(`${JWT_SECRET}::2fa-login-challenge`)
  .digest('hex');

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

function signChallenge(userId: string) {
  return jwt.sign({ sub: userId, typ: '2fa' }, CHALLENGE_SECRET, { expiresIn: '5m' });
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

    // Password is correct — but if 2FA is on, DO NOT issue a session yet. Email a
    // one-time code and hand back a short-lived challenge for /login/2fa.
    if (user.twoFactorEnabled) {
      const issued = await issueOtp(String(user._id), 'login');
      // A cooldown here just means a still-valid code was recently sent.
      if (!('retryAfterMs' in issued)) {
        await sendOtpEmail({ to: user.email, code: issued.code, purpose: 'login' });
      }
      return res.json({
        twoFactorRequired: true,
        challenge: signChallenge(String(user._id)),
        email: user.email,
        cooldownMs: 'retryAfterMs' in issued ? issued.retryAfterMs : issued.cooldownMs,
        ...(IS_PRODUCTION || 'retryAfterMs' in issued ? {} : { devCode: issued.code }),
      });
    }

    const token = signToken(String(user._id));
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/** Verify a login challenge JWT — returns the user id, or null if invalid. */
function readChallenge(challenge: unknown): string | null {
  try {
    const payload = jwt.verify(String(challenge), CHALLENGE_SECRET) as { sub: string; typ?: string };
    return payload.typ === '2fa' ? payload.sub : null;
  } catch {
    return null;
  }
}

const otpMessage = (r: Extract<VerifyResult, { ok: false }>): string => {
  if (r.reason === 'expired') return 'That code has expired. Send a new one.';
  if (r.reason === 'locked') return 'Too many incorrect attempts. Send a new code.';
  if (r.reason === 'missing') return 'No code to check — send a new one.';
  return `Incorrect code.${r.attemptsLeft ? ` ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? '' : 's'} left.` : ''}`;
};

/**
 * POST /api/auth/login/2fa   body: { challenge, code }
 * Second step of a 2FA login: verify the emailed code, then create the session.
 */
router.post('/login/2fa', async (req, res) => {
  try {
    const { challenge, code } = req.body ?? {};
    if (!challenge || !code) {
      return res.status(400).json({ error: 'Verification code is required.' });
    }

    const userId = readChallenge(challenge);
    if (!userId) {
      return res.status(401).json({ error: 'Your login session expired. Please sign in again.' });
    }

    const user = await User.findById(userId);
    if (!user || !user.twoFactorEnabled) {
      return res.status(401).json({ error: 'Please sign in again.' });
    }

    const result = await verifyOtp(userId, 'login', String(code));
    if (!result.ok) {
      return res.status(400).json({ error: otpMessage(result) });
    }
    await clearOtp(userId, 'login');

    const token = signToken(String(user._id));
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('2FA login error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login/2fa/resend   body: { challenge }
 * Email a fresh sign-in code (honours the resend cooldown).
 */
router.post('/login/2fa/resend', async (req, res) => {
  try {
    const userId = readChallenge((req.body ?? {}).challenge);
    if (!userId) {
      return res.status(401).json({ error: 'Your login session expired. Please sign in again.' });
    }
    const user = await User.findById(userId);
    if (!user || !user.twoFactorEnabled) {
      return res.status(401).json({ error: 'Please sign in again.' });
    }

    const issued = await issueOtp(userId, 'login');
    if ('retryAfterMs' in issued) {
      return res.status(429).json({ error: 'Please wait before requesting another code.', retryAfterMs: issued.retryAfterMs });
    }
    await sendOtpEmail({ to: user.email, code: issued.code, purpose: 'login' });
    res.json({ sent: true, cooldownMs: issued.cooldownMs, ...(IS_PRODUCTION ? {} : { devCode: issued.code }) });
  } catch (err) {
    console.error('2FA resend error:', err);
    res.status(500).json({ error: 'Could not send a new code. Please try again.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await findUserById(req.userId!);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ user: toPublicUser(user) });
});

// Two-factor management endpoints — all require a live session.
router.use('/2fa', requireAuth, twoFactorRoutes);

export default router;
