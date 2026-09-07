import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';
import { DEFAULT_PROJECT_STATUSES, DEFAULT_TASK_STATUSES } from './statusDefaults.js';

const permissionsSchema = new Schema(
  {
    manageTasks: { type: Boolean, default: false },
    assignTasks: { type: Boolean, default: false },
    manageProjects: { type: Boolean, default: false },
    deleteItems: { type: Boolean, default: false },
    manageMembers: { type: Boolean, default: false },
  },
  { _id: false },
);

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Just Owner and Member now. Existing 'admin' rows are migrated on startup.
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    joinedAt: { type: Date, default: () => new Date() },
    // Only meaningful for members — an owner implicitly has everything.
    permissions: { type: permissionsSchema, default: () => ({}) },
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
