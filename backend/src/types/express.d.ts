import 'express';
import type { PermissionSet } from '../services/permissions.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      workspaceRole?: 'owner' | 'member';
      workspacePermissions?: PermissionSet;
    }
  }
}
