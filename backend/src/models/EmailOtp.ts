import { Schema, model } from 'mongoose';

/**
 * A short-lived one-time email code. One active document per (user, purpose):
 * issuing a new code replaces any earlier one. A TTL index drops expired rows.
 */
export const OTP_PURPOSES = ['enable', 'disable', 'login'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

const emailOtpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: OTP_PURPOSES, required: true },
    // SHA-256 of the 6-digit code — the plaintext is only ever emailed.
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

emailOtpSchema.index({ userId: 1, purpose: 1 });
// Let MongoDB delete rows once they're past `expiresAt`.
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailOtp = model('EmailOtp', emailOtpSchema);
