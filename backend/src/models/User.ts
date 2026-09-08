import { Schema, model, type InferSchemaType } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    company: { type: String, default: '' },

    // ── Two-factor auth (email OTP) ────────────────────────────────────────
    // When on, sign-in requires a 6-digit code emailed to `email`. The codes
    // themselves live in the EmailOtp collection.
    twoFactorEnabled: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };

export const User = model('User', userSchema);
