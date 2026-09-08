import { Router, type Request } from 'express';
import { Workspace } from '../models/Workspace.js';
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { makeStatusKey, type WorkspaceStatus } from '../services/statusService.js';
import { logActivity } from '../services/auditService.js';
import {
  FALLBACK_PROJECT_STATUS,
  FALLBACK_TASK_STATUS,
} from '../models/statusDefaults.js';

const router = Router({ mergeParams: true });

// Statuses are workspace structure — only the owner can change them.
router.use((req, res, next) => {
  if (req.method === 'GET' || req.workspaceRole === 'owner') return next();
  return res.status(403).json({
    code: 'PERMISSION_DENIED',
    error: 'Only the workspace owner can manage statuses.',
  });
});

type Kind = 'task' | 'project';
const FIELD = { task: 'taskStatuses', project: 'projectStatuses' } as const;
const FALLBACK = { task: FALLBACK_TASK_STATUS, project: FALLBACK_PROJECT_STATUS } as const;

function parseKind(value: string): Kind | null {
  return value === 'task' || value === 'project' ? value : null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

router.get('/', async (req: Request<{ workspaceId: string }>, res) => {
  const ws = await Workspace.findById(req.params.workspaceId).select('taskStatuses projectStatuses');
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });
  res.json({
    taskStatuses: [...ws.taskStatuses].sort((a, b) => a.order - b.order),
    projectStatuses: [...ws.projectStatuses].sort((a, b) => a.order - b.order),
  });
});

router.post('/:kind', async (req: Request<{ workspaceId: string; kind: string }>, res) => {
  const kind = parseKind(req.params.kind);
  if (!kind) return res.status(400).json({ error: 'Invalid status kind.' });

  const { label, color } = req.body ?? {};
  if (!label?.trim()) return res.status(400).json({ error: 'Status name is required.' });
  if (color && !HEX.test(color)) return res.status(400).json({ error: 'Colour must be a hex value like #2E90FA.' });

  const ws = await Workspace.findById(req.params.workspaceId);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });

  const list = ws[FIELD[kind]];
  if (list.length >= 12) return res.status(400).json({ error: 'You can have at most 12 statuses.' });

  const trimmed = label.trim();
  if (list.some((s) => s.label.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(409).json({ error: 'A status with that name already exists.' });
  }

  const key = makeStatusKey(trimmed, list as unknown as WorkspaceStatus[]);
  list.push({
    key,
    label: trimmed,
    color: color || '#64748B',
    order: list.length,
    builtIn: false,
  });
  await ws.save();

  logActivity({
    workspaceId: req.params.workspaceId,
    actorId: req.userId!,
    action: 'status_created',
    meta: { kind, key, label: trimmed },
  });

  res.status(201).json({ statuses: [...list].sort((a, b) => a.order - b.order) });
});

router.patch('/:kind/:key', async (req: Request<{ workspaceId: string; kind: string; key: string }>, res) => {
  const kind = parseKind(req.params.kind);
  if (!kind) return res.status(400).json({ error: 'Invalid status kind.' });

  const { label, color } = req.body ?? {};
  if (color !== undefined && !HEX.test(color)) {
    return res.status(400).json({ error: 'Colour must be a hex value like #2E90FA.' });
  }

  const ws = await Workspace.findById(req.params.workspaceId);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });

  const list = ws[FIELD[kind]];
  const status = list.find((s) => s.key === req.params.key);
  if (!status) return res.status(404).json({ error: 'Status not found' });

  const changed: string[] = [];
  if (label !== undefined) {
    if (!label.trim()) return res.status(400).json({ error: 'Status name is required.' });
    const trimmed = label.trim();
    if (list.some((s) => s.key !== status.key && s.label.toLowerCase() === trimmed.toLowerCase())) {
      return res.status(409).json({ error: 'A status with that name already exists.' });
    }
    if (status.label !== trimmed) changed.push('name');
    status.label = trimmed;
  }
  if (color !== undefined && status.color !== color) {
    changed.push('colour');
    status.color = color;
  } else if (color !== undefined) {
    status.color = color;
  }

  await ws.save();

  if (changed.length) {
    logActivity({
      workspaceId: req.params.workspaceId,
      actorId: req.userId!,
      action: 'status_updated',
      meta: { kind, key: status.key, label: status.label, fields: changed },
    });
  }

  res.json({ statuses: [...list].sort((a, b) => a.order - b.order) });
});

router.put('/:kind/reorder', async (req: Request<{ workspaceId: string; kind: string }>, res) => {
  const kind = parseKind(req.params.kind);
  if (!kind) return res.status(400).json({ error: 'Invalid status kind.' });

  const { keys } = req.body ?? {};
  if (!Array.isArray(keys)) return res.status(400).json({ error: 'keys must be an array.' });

  const ws = await Workspace.findById(req.params.workspaceId);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });

  const list = ws[FIELD[kind]];
  list.forEach((s) => {
    const idx = keys.indexOf(s.key);
    if (idx !== -1) s.order = idx;
  });
  await ws.save();
  res.json({ statuses: [...list].sort((a, b) => a.order - b.order) });
});

router.delete('/:kind/:key', async (req: Request<{ workspaceId: string; kind: string; key: string }>, res) => {
  const kind = parseKind(req.params.kind);
  if (!kind) return res.status(400).json({ error: 'Invalid status kind.' });

  const ws = await Workspace.findById(req.params.workspaceId);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });

  const list = ws[FIELD[kind]];
  const status = list.find((s) => s.key === req.params.key);
  if (!status) return res.status(404).json({ error: 'Status not found' });
  if (status.builtIn) return res.status(400).json({ error: "Built-in statuses can't be deleted." });

  const fallback = FALLBACK[kind];
  const removedLabel = status.label;
  ws[FIELD[kind]] = list.filter((s) => s.key !== req.params.key) as typeof list;
  ws[FIELD[kind]].forEach((s, i) => { s.order = i; });
  await ws.save();

  logActivity({
    workspaceId: req.params.workspaceId,
    actorId: req.userId!,
    action: 'status_deleted',
    meta: { kind, key: req.params.key, label: removedLabel },
  });

  // Move anything that used the deleted status onto the fallback.
  const filter = { workspaceId: req.params.workspaceId, status: req.params.key };
  const update = { $set: { status: fallback } };
  const { modifiedCount } =
    kind === 'task' ? await Task.updateMany(filter, update) : await Project.updateMany(filter, update);

  res.json({
    statuses: [...ws[FIELD[kind]]].sort((a, b) => a.order - b.order),
    reassigned: modifiedCount,
    fallback,
  });
});

export default router;
