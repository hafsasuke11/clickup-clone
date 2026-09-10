import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';

/**
 * A single thing a member did to a task. Kept separate from `AuditLog` (which
 * tracks workspace membership changes) so the task feed can be shown to every
 * member, filtered per project, without touching the members-only audit log.
 */
export const TASK_ACTIVITY_ACTIONS = [
  'task_created',
  'task_renamed',
  'task_status_changed',
  'task_completed',
  'task_reopened',
  'task_assigned',
  'task_unassigned',
  'task_priority_changed',
  'task_due_changed',
  'task_moved',
  'task_description_changed',
  'task_deleted',
  'task_comment_added',
  'task_attachment_added',
  'task_attachment_removed',
  'task_follower_added',
  'task_follower_removed',
  'task_visibility_changed',
  'task_subtask_added',
  'task_subtask_completed',
  'task_subtask_reopened',
  'task_subtask_removed',
] as const;

const taskActivitySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    // Snapshot of the task name at the time — survives a later rename or delete.
    taskName: { type: String, default: '' },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, enum: TASK_ACTIVITY_ACTIONS, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

taskActivitySchema.index({ workspaceId: 1, createdAt: -1 });
taskActivitySchema.index({ workspaceId: 1, projectId: 1, createdAt: -1 });

export const TaskActivity = model('TaskActivity', taskActivitySchema);
