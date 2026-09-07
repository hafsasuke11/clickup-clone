import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';
import { DEFAULT_PROJECT_STATUSES, DEFAULT_TASK_STATUSES } from './statusDefaults.js';

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const statusSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    color: { type: String, default: '#64748B' },
    order: { type: Number, default: 0 },
    builtIn: { type: Boolean, default: false },
  },
  { _id: false },
);

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
    taskStatuses: { type: [statusSchema], default: () => structuredClone(DEFAULT_TASK_STATUSES) },
    projectStatuses: { type: [statusSchema], default: () => structuredClone(DEFAULT_PROJECT_STATUSES) },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

workspaceSchema.index({ 'members.userId': 1 });

export const Workspace = model('Workspace', workspaceSchema);
