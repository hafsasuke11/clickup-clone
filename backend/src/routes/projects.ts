import { Router, type Request } from 'express';
import { Project, PROJECT_PRIORITIES } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { isValidStatus } from '../services/statusService.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { logActivity } from '../services/auditService.js';

type WorkspaceParams = { workspaceId: string };
type ProjectParams = { workspaceId: string; projectId: string };

const router = Router({ mergeParams: true });

router.get('/', async (req: Request<WorkspaceParams>, res) => {
  const { priority, status } = req.query;

  const filter: Record<string, unknown> = { workspaceId: req.params.workspaceId };
  if (priority) filter.priority = priority;
  if (status) filter.status = status;

  const projects = await Project.find(filter).sort({ order: 1, createdAt: 1 });
  res.json({ projects });
});

router.post('/', requirePermission('manageProjects'), async (req: Request<WorkspaceParams>, res) => {
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

  // New projects go to the end of the manual ordering.
  const last = await Project.findOne({ workspaceId: req.params.workspaceId })
    .sort({ order: -1 })
    .select('order');

  const project = await Project.create({
    workspaceId: req.params.workspaceId,
    name: name.trim(),
    description: description ?? '',
    color: color ?? undefined,
    priority: priority ?? 'normal',
    status: status ?? 'pending',
    order: last ? last.order + 1 : 0,
    startDate: startDate ?? null,
    dueDate: dueDate ?? null,
    createdBy: req.userId,
  });

  logActivity({
    workspaceId: req.params.workspaceId,
    actorId: req.userId!,
    action: 'project_created',
    meta: { projectId: String(project._id), name: project.name },
  });

  res.status(201).json({ project });
});

// Persist a manual drag-and-drop ordering. `ids` is the full ordered list of
// project ids for the workspace.
router.put('/reorder', requirePermission('manageProjects'), async (req: Request<WorkspaceParams>, res) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'ids must be an array of project ids.' });
  }

  if (ids.length) {
    await Project.bulkWrite(
      ids.map((id: string, i: number) => ({
        updateOne: {
          filter: { _id: id, workspaceId: req.params.workspaceId },
          update: { $set: { order: i } },
        },
      })),
    );
  }

  const projects = await Project.find({ workspaceId: req.params.workspaceId }).sort({ order: 1, createdAt: 1 });
  res.json({ projects });
});

router.patch('/:projectId', requirePermission('manageProjects'), async (req: Request<ProjectParams>, res) => {
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

  const before = await Project.findOne({ _id: req.params.projectId, workspaceId: req.params.workspaceId });
  if (!before) return res.status(404).json({ error: 'Project not found' });

  const project = await Project.findOneAndUpdate(
    { _id: req.params.projectId, workspaceId: req.params.workspaceId },
    updates,
    { new: true },
  );
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Record which fields actually changed so the activity feed can describe the edit.
  const changed = Object.keys(updates).filter(
    (k) => String(before.get(k) ?? '') !== String(project.get(k) ?? ''),
  );
  if (changed.length) {
    logActivity({
      workspaceId: req.params.workspaceId,
      actorId: req.userId!,
      action: 'project_updated',
      meta: { projectId: String(project._id), name: project.name, fields: changed },
    });
  }

  res.json({ project });
});

router.delete('/:projectId', requirePermission('deleteItems'), async (req: Request<ProjectParams>, res) => {
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

  logActivity({
    workspaceId: req.params.workspaceId,
    actorId: req.userId!,
    action: 'project_deleted',
    meta: { projectId: String(project._id), name: project.name },
  });

  res.status(204).end();
});

export default router;
