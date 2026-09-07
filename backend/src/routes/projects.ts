import { Router, type Request } from 'express';
import { Project, PROJECT_PRIORITIES } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { isValidStatus } from '../services/statusService.js';

type WorkspaceParams = { workspaceId: string };
type ProjectParams = { workspaceId: string; projectId: string };

const router = Router({ mergeParams: true });

router.get('/', async (req: Request<WorkspaceParams>, res) => {
  const { priority, status } = req.query;

  const filter: Record<string, unknown> = { workspaceId: req.params.workspaceId };
  if (priority) filter.priority = priority;
  if (status) filter.status = status;

  const projects = await Project.find(filter).sort({ createdAt: 1 });
  res.json({ projects });
});

router.post('/', async (req: Request<WorkspaceParams>, res) => {
  const { name, description, color, priority, status, startDate, dueDate } = req.body ?? {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Project name is required.' });
  }
  if (priority && !PROJECT_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority.' });
  }
  if (status && !(await isValidStatus(req.params.workspaceId, 'project', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const project = await Project.create({
    workspaceId: req.params.workspaceId,
    name: name.trim(),
    description: description ?? '',
    color: color ?? undefined,
    priority: priority ?? 'normal',
    status: status ?? 'active',
    startDate: startDate ?? null,
    dueDate: dueDate ?? null,
    createdBy: req.userId,
  });
  res.status(201).json({ project });
});

router.patch('/:projectId', async (req: Request<ProjectParams>, res) => {
  const { name, description, color, priority, status, startDate, dueDate } = req.body ?? {};

  if (priority && !PROJECT_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority.' });
  }
  if (status && !(await isValidStatus(req.params.workspaceId, 'project', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Project name is required.' });
    updates.name = name.trim();
  }
  if (description !== undefined) updates.description = description;
  if (color !== undefined) updates.color = color;
  if (priority !== undefined) updates.priority = priority;
  if (status !== undefined) updates.status = status;
  if (startDate !== undefined) updates.startDate = startDate || null;
  if (dueDate !== undefined) updates.dueDate = dueDate || null;

  const project = await Project.findOneAndUpdate(
    { _id: req.params.projectId, workspaceId: req.params.workspaceId },
    updates,
    { new: true },
  );
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ project });
});

router.delete('/:projectId', async (req: Request<ProjectParams>, res) => {
  const project = await Project.findOneAndDelete({
    _id: req.params.projectId,
    workspaceId: req.params.workspaceId,
  });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Keep the tasks, just detach them from the deleted project.
  await Task.updateMany(
    { workspaceId: req.params.workspaceId, projectId: req.params.projectId },
    { $set: { projectId: null } },
  );

  res.status(204).end();
});

export default router;
