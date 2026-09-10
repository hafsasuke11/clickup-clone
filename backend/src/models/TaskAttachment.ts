import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';

/**
 * A file attached to a task. The bytes are stored base64-encoded in `data` on
 * this document (no filesystem / bucket needed, so uploads survive redeploys).
 * `data` is stripped from `toJSON`, so list responses carry metadata only — the
 * payload is fetched one attachment at a time from the download route.
 */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB per file

const taskAttachmentSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 260 },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 }, // original byte length, for display
    data: { type: String, required: true }, // base64, no data: prefix
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret: Record<string, unknown>) {
        docToJSON(doc, ret as Record<string, any>);
        delete ret.data; // never ship the payload in a list response
        return ret;
      },
    },
  },
);

taskAttachmentSchema.index({ taskId: 1, createdAt: 1 });

export { MAX_ATTACHMENT_BYTES };
export const TaskAttachment = model('TaskAttachment', taskAttachmentSchema);
