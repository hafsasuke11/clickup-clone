import type { NextFunction, Request, Response } from 'express';
import { PERMISSION_ACTION, type PermissionKey } from '../services/permissions.js';

/**
 * Gate a route on one or more workspace permissions. `requireWorkspaceMember`
 * must have run first (it attaches `req.workspacePermissions`).
 */
export function requirePermission(...keys: PermissionKey[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const perms = req.workspacePermissions;
    if (perms && keys.every((k) => perms[k])) return next();

    const phrase = keys.map((k) => PERMISSION_ACTION[k]).join(' and ');
    return res.status(403).json({
      code: 'PERMISSION_DENIED',
      error: `You don't have permission to ${phrase}. Ask the workspace owner to grant it.`,
    });
  };
}

/** Owner-only guard for things that can never be delegated. */
export function requireOwner(what = 'do this') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.workspaceRole === 'owner') return next();
    return res.status(403).json({
      code: 'PERMISSION_DENIED',
      error: `Only the workspace owner can ${what}.`,
    });
  };
}
