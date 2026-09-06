import { Schema, model } from 'mongoose';
import { idTransform } from '../utils/toJSON.js';

export const TASK_STATUSES = ['pending', 'in_progress', 'todo', 'completed'] as const;
export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;

const taskSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: TASK_STATUSES, default: 'pending' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'normal' },
    dueDate: { type: Date, default: null },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { transform: idTransform } },
);

taskSchema.index({ workspaceId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, dueDate: 1 });
taskSchema.index({ workspaceId: 1, assigneeId: 1 });

export const Task = model('Task', taskSchema);
