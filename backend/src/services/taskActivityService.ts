import { TaskActivity, type TASK_ACTIVITY_ACTIONS } from '../models/TaskActivity.js';

type TaskActivityAction = (typeof TASK_ACTIVITY_ACTIONS)[number];

export interface TaskActivityInput {
  workspaceId: string;
  projectId?: string | null;
  taskId?: string | null;
  taskName: string;
  actorId: string;
  action: TaskActivityAction;
  meta?: Record<string, unknown>;
}

/** Fire-and-forget: a failed write must never break the task request. */
export function logTaskActivity(entries: TaskActivityInput | TaskActivityInput[]) {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  void TaskActivity.insertMany(
    list.map((e) => ({
      workspaceId: e.workspaceId,
      projectId: e.projectId ?? null,
      taskId: e.taskId ?? null,
      taskName: e.taskName,
      actorId: e.actorId,
      action: e.action,
      meta: e.meta ?? {},
    })),
  ).catch((err) => console.error('logTaskActivity failed:', err));
}

/**
 * Diff an old task against the patch that was applied and return the list of
 * activity entries it should produce. `completedKey` is the status key that
 * counts as "done" (the built-in `completed`).
 */
export function diffTaskActivities(opts: {
  workspaceId: string;
  actorId: string;
  before: {
    _id: unknown;
    name: string;
    status: string;
    priority: string;
    assigneeId: unknown;
    dueDate: Date | null | undefined;
    projectId: unknown;
    description: string;
  };
  patch: Record<string, unknown>;
  completedKey?: string;
}): TaskActivityInput[] {
  const { workspaceId, actorId, before, patch } = opts;
  const completedKey = opts.completedKey ?? 'completed';
  const out: TaskActivityInput[] = [];
  const base = {
    workspaceId,
    actorId,
    taskId: String(before._id),
    taskName: typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : before.name,
    projectId:
      patch.projectId !== undefined
        ? ((patch.projectId as string | null) || null)
        : (before.projectId ? String(before.projectId) : null),
  };

  if (typeof patch.name === 'string' && patch.name.trim() && patch.name.trim() !== before.name) {
    out.push({ ...base, action: 'task_renamed', meta: { from: before.name, to: patch.name.trim() } });
  }

  if (patch.status !== undefined && patch.status !== before.status) {
    // Carry the assignee so the feed can flag "completed a task assigned to someone else".
    const assigneeId = before.assigneeId ? String(before.assigneeId) : null;
    if (patch.status === completedKey) {
      out.push({ ...base, action: 'task_completed', meta: { from: before.status, assigneeId } });
    } else if (before.status === completedKey) {
      out.push({ ...base, action: 'task_reopened', meta: { to: patch.status, assigneeId } });
    } else {
      out.push({ ...base, action: 'task_status_changed', meta: { from: before.status, to: patch.status, assigneeId } });
    }
  }

  if (patch.priority !== undefined && patch.priority !== before.priority) {
    out.push({ ...base, action: 'task_priority_changed', meta: { from: before.priority, to: patch.priority } });
  }

  if (patch.assigneeId !== undefined) {
    const next = (patch.assigneeId as string | null) || null;
    const prev = before.assigneeId ? String(before.assigneeId) : null;
    if (next !== prev) {
      out.push({
        ...base,
        action: next ? 'task_assigned' : 'task_unassigned',
        meta: { from: prev, to: next },
      });
    }
  }

  if (patch.dueDate !== undefined) {
    const next = patch.dueDate ? new Date(patch.dueDate as string).toISOString() : null;
    const prev = before.dueDate ? new Date(before.dueDate).toISOString() : null;
    if (next !== prev) {
      out.push({ ...base, action: 'task_due_changed', meta: { from: prev, to: next } });
    }
  }

  if (patch.projectId !== undefined) {
    const next = (patch.projectId as string | null) || null;
    const prev = before.projectId ? String(before.projectId) : null;
    if (next !== prev) {
      out.push({ ...base, action: 'task_moved', meta: { fromProjectId: prev, toProjectId: next } });
    }
  }

  if (typeof patch.description === 'string' && patch.description !== before.description) {
    out.push({ ...base, action: 'task_description_changed', meta: {} });
  }

  return out;
}
