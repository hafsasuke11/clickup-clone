import crypto from 'crypto';
import { Schema, model } from 'mongoose';
import { idTransform } from '../utils/toJSON.js';

const inviteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    token: { type: String, required: true, unique: true, default: () => crypto.randomBytes(24).toString('hex') },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true, toJSON: { transform: idTransform } },
);

export const WorkspaceInvite = model('WorkspaceInvite', inviteSchema);
