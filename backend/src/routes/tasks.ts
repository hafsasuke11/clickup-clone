import { Router, type Request } from 'express';
import { Task, TASK_PRIORITIES } from '../models/Task.js';
import { isValidStatus } from '../services/statusService.js';
import { logTaskActivity, diffTaskActivities } from '../services/taskActivityService.js';
import { requirePermission } from '../middleware/requirePermission.js';

const denied = (action: string) => ({
  code: 'PERMISSION_DENIED' as const,
  error: `You don't have permission to ${action}. Ask the workspace owner to grant it.`,
});

type WorkspaceParams = { workspaceId: string };
type TaskParams = { workspaceId: string; taskId: string };

const router = Router({ mergeParams: true });

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A task counts as a duplicate when another task in the same project (or the
 *  same "no project" bucket) has the same name, ignoring case and surrounding
 *  whitespace. Scoped to the workspace, so it catches duplicates no matter
 *  which member is adding the task. */
async function findDuplicateTask(workspaceId: string, name: string, projectId: string | null) {
  return Task.findOne({
    workspaceId,
    projectId: projectId ?? null,
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
  });
}

router.get('/', async (req: Request<WorkspaceParams>, res) => {
  const { workspaceId } = req.params;
  const { status, assigneeId, priority, projectId } = req.query;

  const filter: Record<string, unknown> = { workspaceId };
  if (status) filter.status = status;
  if (assigneeId) filter.assigneeId = assigneeId;
  if (priority) filter.priority = priority;
  if (projectId) filter.projectId = projectId;

  const tasks = await Task.find(filter).sort({ order: 1, createdAt: -1 });
  res.json({ tasks });
});

// Check whether a task name is already taken in a project, without creating
// anything. Used by the client for an instant warning before it submits.
router.get('/check-duplicate', async (req: Request<WorkspaceParams>, res) => {
  const name = String(req.query.name ?? '');
  if (!name.trim()) return res.json({ duplicate: null });
  const projectId = req.query.projectId ? String(req.query.projectId) : null;
  const existing = await findDuplicateTask(req.params.workspaceId, name, projectId);
  res.json({
    duplicate: existing
      ? { id: String(existing._id), name: existing.name, status: existing.status }
      : null,
  });
});

router.post('/', requirePermission('manageTasks'), async (req: Request<WorkspaceParams>, res) => {
  const { name, description, status, priority, dueDate, assigneeId, projectId, force } = req.body ?? {};

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Task name is required.' });
  }
  if (assigneeId && !req.workspacePermissions?.assignTasks) {
    return res.status(403).json(denied('assign tasks'));
  }
  if (status && !(await isValidStatus(req.params.workspaceId, 'task', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (priority && !TASK_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority.' });
  }

  // Block accidental duplicates unless the client explicitly opts in with `force`.
  if (!force) {
    const existing = await findDuplicateTask(req.params.workspaceId, name, projectId || null);
    if (existing) {
      return res.status(409).json({
        error: 'This task already exists. Adding it again will create a duplicate.',
        code: 'DUPLICATE_TASK',
        existing: { id: String(existing._id), name: existing.name, status: existing.status },
      });
    }
  }

  // New tasks float to the top of their column: one step below the current min.
  const effectiveStatus = status ?? 'pending';
  const top = await Task.findOne({ workspaceId: req.params.workspaceId, status: effectiveStatus })
    .sort({ order: 1 })
    .select('order');

  const task = await Task.create({
    workspaceId: req.params.workspaceId,
    projectId: projectId || null,
    name: name.trim(),
    description: description ?? '',
    status: effectiveStatus,
    priority: priority ?? 'normal',
    order: top ? top.order - 1 : 0,
    dueDate: dueDate ?? null,
    assigneeId: assigneeId || null,
    createdBy: req.userId,
  });

  logTaskActivity({
    workspaceId: req.params.workspaceId,
    projectId: task.projectId ? String(task.projectId) : null,
    taskId: String(task._id),
    taskName: task.name,
    actorId: req.userId!,
    action: 'task_created',
    meta: { status: task.status, priority: task.priority, forced: Boolean(force) },
  });

  res.status(201).json({ task });
});

// Persist a manual drag-and-drop ordering. `ids` is the full ordered list of
// task ids for a single column; when `status` is given every task in the list
// is moved onto it (covers a card dragged between columns).
router.put('/reorder', requirePermission('manageTasks'), async (req: Request<WorkspaceParams>, res) => {
  const { status, ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'ids must be an array of task ids.' });
  }
  if (status !== undefined && !(await isValidStatus(req.params.workspaceId, 'task', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  if (ids.length) {
    // A drag between columns changes status — record that for the activity feed.
    if (status !== undefined) {
      const moving = await Task.find({
        _id: { $in: ids },
        workspaceId: req.params.workspaceId,
        status: { $ne: status },
      });
      logTaskActivity(
        moving.map((t) => ({
          workspaceId: req.params.workspaceId,
          projectId: t.projectId ? String(t.projectId) : null,
          taskId: String(t._id),
          taskName: t.name,
          actorId: req.userId!,
          action: status === 'completed' ? 'task_completed' : t.status === 'completed' ? 'task_reopened' : 'task_status_changed',
          meta: { from: t.status, to: status, assigneeId: t.assigneeId ? String(t.assigneeId) : null },
        })),
      );
    }

    await Task.bulkWrite(
      ids.map((id: string, i: number) => ({
        updateOne: {
          filter: { _id: id, workspaceId: req.params.workspaceId },
          update: { $set: { order: i, ...(status !== undefined ? { status } : {}) } },
        },
      })),
    );
  }

  const tasks = await Task.find({ workspaceId: req.params.workspaceId }).sort({ order: 1, createdAt: -1 });
  res.json({ tasks });
});

router.get('/:taskId', async (req: Request<TaskParams>, res) => {
  const task = await Task.findOne({ _id: req.params.taskId, workspaceId: req.params.workspaceId });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

router.patch('/:taskId', async (req: Request<TaskParams>, res) => {
  const { name, description, status, priority, dueDate, assigneeId, projectId } = req.body ?? {};

  // Changing the assignee needs "assign tasks"; changing anything else needs
  // "create or edit tasks".
  const touchesAssignee = assigneeId !== undefined;
  const touchesOther = [name, description, status, priority, dueDate, projectId].some((v) => v !== undefined);
  if (touchesAssignee && !req.workspacePermissions?.assignTasks) {
    return res.status(403).json(denied('assign tasks'));
  }
  if (touchesOther && !req.workspacePermissions?.manageTasks) {
    return res.status(403).json(denied('edit tasks'));
  }

  if (status && !(await isValidStatus(req.params.workspaceId, 'task', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (priority && !TASK_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority.' });
  }

  const before = await Task.findOne({ _id: req.params.taskId, workspaceId: req.params.workspaceId });
  if (!before) return res.status(404).json({ error: 'Task not found' });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (priority !== undefined) updates.priority = priority;
  if (dueDate !== undefined) updates.dueDate = dueDate;
  if (assigneeId !== undefined) updates.assigneeId = assigneeId || null;
  if (projectId !== undefined) updates.projectId = projectId || null;

  const task = await Task.findOneAndUpdate(
    { _id: req.params.taskId, workspaceId: req.params.workspaceId },
    updates,
    { new: true },
  );
  if (!task) return res.status(404).json({ error: 'Task not found' });

  logTaskActivity(
    diffTaskActivities({
      workspaceId: req.params.workspaceId,
      actorId: req.userId!,
      before: {
        _id: before._id,
        name: before.name,
        status: before.status,
        priority: before.priority,
        assigneeId: before.assigneeId,
        dueDate: before.dueDate,
        projectId: before.projectId,
        description: before.description,
      },
      patch: updates,
    }),
  );

  res.json({ task });
});

router.delete('/:taskId', requirePermission('deleteItems'), async (req: Request<TaskParams>, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.taskId, workspaceId: req.params.workspaceId });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  logTaskActivity({
    workspaceId: req.params.workspaceId,
    projectId: task.projectId ? String(task.projectId) : null,
    taskId: String(task._id),
    taskName: task.name,
    actorId: req.userId!,
    action: 'task_deleted',
    meta: { status: task.status },
  });

  res.status(204).end();
});

export default router;
