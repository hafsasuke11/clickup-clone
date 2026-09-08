/**
 * Two-factor auth management (email OTP). Mounted behind `requireAuth`.
 * Login-time verification lives in auth.ts.
 *
 *   Enable:  POST /enable/send  -> code emailed  ->  POST /enable  { code }
 *   Disable: POST /disable/send -> code emailed  ->  POST /disable { code }
 */
import { Router } from 'express';
import { User } from '../models/User.js';
import { IS_PRODUCTION } from '../config.js';
import { sendOtpEmail } from '../services/emailService.js';
import { issueOtp, verifyOtp, clearOtp, type VerifyResult } from '../services/emailOtpService.js';

const router = Router();

const codeOf = (body: unknown): string =>
  String((body as { code?: unknown })?.code ?? '').trim();

const verifyMessage = (r: Extract<VerifyResult, { ok: false }>): string => {
  if (r.reason === 'expired') return 'That code has expired. Request a new one.';
  if (r.reason === 'locked') return 'Too many incorrect attempts. Request a new code.';
  if (r.reason === 'missing') return 'No code to check — request a new one.';
  return `Incorrect code.${r.attemptsLeft ? ` ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? '' : 's'} left.` : ''}`;
};

/** GET /api/auth/2fa/status */
router.get('/status', async (req, res) => {
  const user = await User.findById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ enabled: Boolean(user.twoFactorEnabled), email: user.email });
});

/** POST /api/auth/2fa/enable/send — email a confirmation code. */
router.post('/enable/send', async (req, res) => {
  const user = await User.findById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.twoFactorEnabled) {
    return res.status(409).json({ error: 'Two-factor authentication is already enabled.' });
  }

  const issued = await issueOtp(String(user._id), 'enable');
  if ('retryAfterMs' in issued) {
    return res.status(429).json({ error: 'Please wait before requesting another code.', retryAfterMs: issued.retryAfterMs });
  }

  await sendOtpEmail({ to: user.email, code: issued.code, purpose: 'enable' });
  res.json({
    sent: true,
    email: user.email,
    cooldownMs: issued.cooldownMs,
    ...(IS_PRODUCTION ? {} : { devCode: issued.code }),
  });
});

/** POST /api/auth/2fa/enable  { code } */
router.post('/enable', async (req, res) => {
  const user = await User.findById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.twoFactorEnabled) {
    return res.status(409).json({ error: 'Two-factor authentication is already enabled.' });
  }

  const result = await verifyOtp(String(user._id), 'enable', codeOf(req.body));
  if (!result.ok) return res.status(400).json({ error: verifyMessage(result) });

  await User.updateOne({ _id: user._id }, { $set: { twoFactorEnabled: true } });
  await clearOtp(String(user._id), 'enable');
  res.json({ enabled: true });
});

/** POST /api/auth/2fa/disable/send — email a confirmation code. */
router.post('/disable/send', async (req, res) => {
  const user = await User.findById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.twoFactorEnabled) {
    return res.status(400).json({ error: 'Two-factor authentication is not enabled.' });
  }

  const issued = await issueOtp(String(user._id), 'disable');
  if ('retryAfterMs' in issued) {
    return res.status(429).json({ error: 'Please wait before requesting another code.', retryAfterMs: issued.retryAfterMs });
  }

  await sendOtpEmail({ to: user.email, code: issued.code, purpose: 'disable' });
  res.json({
    sent: true,
    email: user.email,
    cooldownMs: issued.cooldownMs,
    ...(IS_PRODUCTION ? {} : { devCode: issued.code }),
  });
});

/** POST /api/auth/2fa/disable  { code } */
router.post('/disable', async (req, res) => {
  const user = await User.findById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.twoFactorEnabled) {
    return res.status(400).json({ error: 'Two-factor authentication is not enabled.' });
  }

  const result = await verifyOtp(String(user._id), 'disable', codeOf(req.body));
  if (!result.ok) return res.status(400).json({ error: verifyMessage(result) });

  await User.updateOne({ _id: user._id }, { $set: { twoFactorEnabled: false } });
  await clearOtp(String(user._id), 'disable');
  res.json({ enabled: false });
});

export default router;
