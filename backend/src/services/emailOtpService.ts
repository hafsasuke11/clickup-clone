/**
 * Issue and verify the 6-digit email codes used for two-factor auth.
 *
 * - one active code per (user, purpose); issuing a new one replaces the old
 * - codes expire after CODE_TTL and are single-use
 * - MAX_ATTEMPTS wrong guesses burn the code (forces a resend)
 * - RESEND_COOLDOWN throttles how often a new code can be requested
 */
import crypto from 'crypto';
import { EmailOtp, type OtpPurpose } from '../models/EmailOtp.js';

export const CODE_TTL_MS = 5 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 30 * 1000;
export const MAX_ATTEMPTS = 5;

const hash = (code: string) => crypto.createHash('sha256').update(code).digest('hex');

/** A uniformly-random 6-digit string, e.g. "004271". */
function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export interface IssueResult {
  code: string;
  expiresAt: Date;
  cooldownMs: number;
}

/**
 * Create (or replace) the active code for `(userId, purpose)`.
 * Returns `{ retryAfterMs }` instead if the last code is still within cooldown.
 */
export async function issueOtp(
  userId: string,
  purpose: OtpPurpose,
): Promise<IssueResult | { retryAfterMs: number }> {
  const latest = await EmailOtp.findOne({ userId, purpose }).sort({ createdAt: -1 });
  if (latest && !latest.consumedAt) {
    const age = Date.now() - latest.createdAt.getTime();
    if (age < RESEND_COOLDOWN_MS) {
      return { retryAfterMs: RESEND_COOLDOWN_MS - age };
    }
  }

  await EmailOtp.deleteMany({ userId, purpose });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const created = await EmailOtp.create({ userId, purpose, codeHash: hash(code), expiresAt, attempts: 0, consumedAt: null });
  // If a concurrent call slipped a row in, keep only the one we just made so
  // verification is deterministic.
  await EmailOtp.deleteMany({ userId, purpose, _id: { $ne: created._id } });

  return { code, expiresAt, cooldownMs: RESEND_COOLDOWN_MS };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'expired' | 'locked' | 'invalid'; attemptsLeft?: number };

/** Check a user-entered code and, on success, consume it. */
export async function verifyOtp(userId: string, purpose: OtpPurpose, input: string): Promise<VerifyResult> {
  const code = String(input ?? '').replace(/\s+/g, '');
  const otp = await EmailOtp.findOne({ userId, purpose }).sort({ createdAt: -1 });

  if (!otp || otp.consumedAt) return { ok: false, reason: 'missing' };
  if (otp.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' };

  if (!/^\d{6}$/.test(code) || otp.codeHash !== hash(code)) {
    otp.attempts += 1;
    if (otp.attempts >= MAX_ATTEMPTS) otp.consumedAt = new Date(); // burn it
    await otp.save();
    return {
      ok: false,
      reason: otp.attempts >= MAX_ATTEMPTS ? 'locked' : 'invalid',
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - otp.attempts),
    };
  }

  otp.consumedAt = new Date();
  await otp.save();
  return { ok: true };
}

/** Drop any pending codes for a purpose (e.g. after the flow completes). */
export async function clearOtp(userId: string, purpose: OtpPurpose): Promise<void> {
  await EmailOtp.deleteMany({ userId, purpose });
}
