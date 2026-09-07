import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';

// Statuses are defined per-workspace (workspace.taskStatuses), so `status` is a
// free string here and validated against the workspace's list in the routes.
export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;

const taskSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'normal' },
    dueDate: { type: Date, default: null },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

taskSchema.index({ workspaceId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, dueDate: 1 });
taskSchema.index({ workspaceId: 1, assigneeId: 1 });

export const Task = model('Task', taskSchema);
