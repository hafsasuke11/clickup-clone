import type { NextFunction, Request, Response } from 'express';
import { Workspace } from '../models/Workspace.js';
import { effectivePermissions } from '../services/permissions.js';

export async function requireWorkspaceMember(req: Request, res: Response, next: NextFunction) {
  const { workspaceId } = req.params;

  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const membership = workspace.members.find((m) => String(m.userId) === req.userId);
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this workspace' });
    }

    // Any non-owner role is treated as a plain member.
    req.workspaceRole = membership.role === 'owner' ? 'owner' : 'member';
    req.workspacePermissions = effectivePermissions(membership);
    next();
  } catch {
    res.status(404).json({ error: 'Workspace not found' });
  }
}
