import type { ActivityEntry, TaskActivityAction, TaskActivityEntry } from './types';

export function describeActivity(entry: ActivityEntry): string {
  const meta = entry.meta;
  const target = entry.target?.fullName ?? (meta.email as string | undefined) ?? 'someone';

  switch (entry.action) {
    case 'member_invited':
      return meta.resent ? `resent an invite to ${target}` : `invited ${target}`;
    case 'member_added':
      return `added ${target}`;
    case 'invite_revoked':
      return `revoked the invite for ${target}`;
    case 'role_changed':
      return `changed ${target}'s role from ${meta.oldRole} to ${meta.newRole}`;
    case 'member_removed':
      return `removed ${target}`;
    case 'member_left':
      return `left the workspace`;
    case 'workspace_renamed':
      return `renamed the workspace from "${meta.oldName}" to "${meta.newName}"`;
    case 'ownership_transferred':
      return `transferred ownership to ${target}`;
    case 'permissions_changed': {
      const granted = (meta.granted as string[] | undefined) ?? [];
      const revoked = (meta.revoked as string[] | undefined) ?? [];
      const parts: string[] = [];
      if (granted.length) parts.push(`granted ${granted.length}`);
      if (revoked.length) parts.push(`revoked ${revoked.length}`);
      return `updated ${target}'s permissions (${parts.join(', ') || 'no change'})`;
    }
    case 'project_created':
      return `created project "${meta.name}"`;
    case 'project_deleted':
      return `deleted project "${meta.name}"`;
    default:
      return entry.action;
  }
}

/** Which of the four summary buckets an action falls into. */
export type ActivityBucket = 'added' | 'completed' | 'updated' | 'deleted';

export function activityBucket(action: TaskActivityAction): ActivityBucket {
  if (action === 'task_created') return 'added';
  if (action === 'task_completed') return 'completed';
  if (action === 'task_deleted') return 'deleted';
  return 'updated';
}

const priorityLabel = (p: unknown) => String(p ?? '').replace(/\b\w/, (c) => c.toUpperCase());
const shortDate = (v: unknown) =>
  v ? new Date(String(v)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'no date';

/**
 * Present-tense description of a task activity, without the actor name or the
 * task name (the feed renders those separately). `statusLabel` resolves a status
 * key to its display label; `projectName` resolves a project id.
 */
export function describeTaskActivity(
  entry: TaskActivityEntry,
  statusLabel: (key: string) => string,
  projectName: (id: string | null) => string,
  assigneeName?: (id: string) => string,
): string {
  const m = entry.meta ?? {};

  // When someone acts on a task that belongs to a different person, spell that out.
  const assigneeId = typeof m.assigneeId === 'string' ? m.assigneeId : null;
  const forSomeoneElse = assigneeId != null && assigneeId !== (entry.actor?.id ?? null);
  const assignedToNote = forSomeoneElse
    ? ` (assigned to ${assigneeName ? assigneeName(assigneeId) : 'someone else'})`
    : '';

  switch (entry.action) {
    case 'task_created':
      return 'created this task';
    case 'task_renamed':
      return `renamed it from "${m.from}"`;
    case 'task_status_changed':
      return `moved it from ${statusLabel(String(m.from))} to ${statusLabel(String(m.to))}${assignedToNote}`;
    case 'task_completed':
      return `marked it complete${assignedToNote}`;
    case 'task_reopened':
      return `reopened it as ${statusLabel(String(m.to))}${assignedToNote}`;
    case 'task_assigned':
      return 'changed the assignee';
    case 'task_unassigned':
      return 'removed the assignee';
    case 'task_priority_changed':
      return `set priority from ${priorityLabel(m.from)} to ${priorityLabel(m.to)}`;
    case 'task_due_changed':
      return `changed the due date to ${shortDate(m.to)}`;
    case 'task_moved':
      return `moved it to ${projectName((m.toProjectId as string | null) ?? null)}`;
    case 'task_description_changed':
      return 'edited the description';
    case 'task_deleted':
      return 'deleted this task';
    default:
      return entry.action;
  }
}
