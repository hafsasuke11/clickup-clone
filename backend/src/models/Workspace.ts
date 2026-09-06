import { Schema, model } from 'mongoose';
import { idTransform } from '../utils/toJSON.js';

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true, toJSON: { transform: idTransform } },
);

workspaceSchema.index({ 'members.userId': 1 });

export const Workspace = model('Workspace', workspaceSchema);
