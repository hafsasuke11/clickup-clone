import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';

export const PROJECT_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
// Statuses are per-workspace (workspace.projectStatuses); validated in the routes.

const projectSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#6D4FE0' },
    priority: { type: String, enum: PROJECT_PRIORITIES, default: 'normal' },
    status: { type: String, default: 'pending' },
    // Manual sort position on the Projects page (drag-and-drop). Lower comes first.
    order: { type: Number, default: 0 },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

export const Project = model('Project', projectSchema);
