import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';

/**
 * A comment left on a task from the two-panel Tasks page. Kept in its own
 * collection (not embedded on the task) so the task document stays small and
 * comment history survives independently.
 */
const taskCommentSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

taskCommentSchema.index({ taskId: 1, createdAt: 1 });

export const TaskComment = model('TaskComment', taskCommentSchema);
