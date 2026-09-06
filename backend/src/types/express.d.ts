import 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      workspaceRole?: 'owner' | 'admin' | 'member';
    }
  }
}
