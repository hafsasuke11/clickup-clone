import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';

export const AUDIT_ACTIONS = [
  'member_invited',
  'member_added',
  'invite_revoked',
  'role_changed',
  'member_removed',
  'member_left',
  'workspace_renamed',
  'ownership_transferred',
  'permissions_changed',
  'project_created',
  'project_deleted',
] as const;

const auditLogSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

auditLogSchema.index({ workspaceId: 1, createdAt: -1 });

export const AuditLog = model('AuditLog', auditLogSchema);
