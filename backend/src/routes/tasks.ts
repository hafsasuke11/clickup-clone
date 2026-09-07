import { Router, type Request } from 'express';
import { Task, TASK_PRIORITIES } from '../models/Task.js';
import { isValidStatus } from '../services/statusService.js';

type WorkspaceParams = { workspaceId: string };
type TaskParams = { workspaceId: string; taskId: string };

const router = Router({ mergeParams: true });

router.get('/', async (req: Request<WorkspaceParams>, res) => {
  const { workspaceId } = req.params;
  const { status, assigneeId, priority, projectId } = req.query;

  const filter: Record<string, unknown> = { workspaceId };
  if (status) filter.status = status;
  if (assigneeId) filter.assigneeId = assigneeId;
  if (priority) filter.priority = priority;
  if (projectId) filter.projectId = projectId;

  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  res.json({ tasks });
});

router.post('/', async (req: Request<WorkspaceParams>, res) => {
  const { name, description, status, priority, dueDate, assigneeId, projectId } = req.body ?? {};

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Task name is required.' });
  }
  if (status && !(await isValidStatus(req.params.workspaceId, 'task', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (priority && !TASK_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority.' });
  }

  const task = await Task.create({
    workspaceId: req.params.workspaceId,
    projectId: projectId || null,
    name: name.trim(),
    description: description ?? '',
    status: status ?? 'pending',
    priority: priority ?? 'normal',
    dueDate: dueDate ?? null,
    assigneeId: assigneeId || null,
    createdBy: req.userId,
  });
  res.status(201).json({ task });
});

router.get('/:taskId', async (req: Request<TaskParams>, res) => {
  const task = await Task.findOne({ _id: req.params.taskId, workspaceId: req.params.workspaceId });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

router.patch('/:taskId', async (req: Request<TaskParams>, res) => {
  const { name, description, status, priority, dueDate, assigneeId, projectId } = req.body ?? {};

  if (status && !(await isValidStatus(req.params.workspaceId, 'task', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (priority && !TASK_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority.' });
  }

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
  res.json({ task });
});

router.delete('/:taskId', async (req: Request<TaskParams>, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.taskId, workspaceId: req.params.workspaceId });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.status(204).end();
});

export default router;
