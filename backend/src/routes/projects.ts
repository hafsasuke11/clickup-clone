import { Router, type Request } from 'express';
import { Project } from '../models/Project.js';

type WorkspaceParams = { workspaceId: string };

const router = Router({ mergeParams: true });

router.get('/', async (req: Request<WorkspaceParams>, res) => {
  const projects = await Project.find({ workspaceId: req.params.workspaceId }).sort({ createdAt: 1 });
  res.json({ projects });
});

router.post('/', async (req: Request<WorkspaceParams>, res) => {
  const { name, color } = req.body ?? {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  const project = await Project.create({
    workspaceId: req.params.workspaceId,
    name: name.trim(),
    color: color ?? undefined,
    createdBy: req.userId,
  });
  res.status(201).json({ project });
});

export default router;
