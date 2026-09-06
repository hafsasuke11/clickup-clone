import { AuditLog, type AUDIT_ACTIONS } from '../models/AuditLog.js';

export function logActivity(entry: {
  workspaceId: string;
  actorId: string;
  action: (typeof AUDIT_ACTIONS)[number];
  targetUserId?: string | null;
  meta?: Record<string, unknown>;
}) {
  void AuditLog.create({
    workspaceId: entry.workspaceId,
    actorId: entry.actorId,
    action: entry.action,
    targetUserId: entry.targetUserId ?? null,
    meta: entry.meta ?? {},
  }).catch((err) => console.error('logActivity failed:', err));
}
