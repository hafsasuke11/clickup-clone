import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';

// Statuses are defined per-workspace (workspace.taskStatuses), so `status` is a
// free string here and validated against the workspace's list in the routes.
export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export const TASK_VISIBILITIES = ['private', 'public'] as const;

// A checklist item on a task. Embedded (not its own collection) so it always
// travels with the task — progress can then be shown in every task list without
// an extra query. Additive: existing tasks read back with `subtasks: []`.
const subtaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 500 },
    done: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

const taskSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'normal' },
    // Manual sort position within a status column (Board / List drag-and-drop).
    // Lower comes first; new tasks float to the top of their column.
    order: { type: Number, default: 0 },
    dueDate: { type: Date, default: null },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Members who opted in to this task's activity. Additive: existing tasks
    // read back as an empty list until the first follow.
    followers: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    // 'private' keeps the task visible to its creator, assignee and followers;
    // 'public' shows it to the whole workspace. Existing tasks default to
    // 'private' with no migration needed.
    visibility: { type: String, enum: TASK_VISIBILITIES, default: 'private' },
    // Checklist items; task progress is derived from these (done / total).
    subtasks: { type: [subtaskSchema], default: [] },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

taskSchema.index({ workspaceId: 1, status: 1, order: 1 });
taskSchema.index({ workspaceId: 1, dueDate: 1 });
taskSchema.index({ workspaceId: 1, assigneeId: 1 });

export const Task = model('Task', taskSchema);
