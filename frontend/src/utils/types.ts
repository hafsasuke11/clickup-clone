export interface User {
  id: string;
  email: string;
  fullName: string;
  company: string;
  createdAt: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspaceMemberRaw {
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceStatus {
  key: string;
  label: string;
  color: string;
  order: number;
  builtIn: boolean;
}

export type StatusKind = 'task' | 'project';

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: WorkspaceMemberRaw[];
  taskStatuses: WorkspaceStatus[];
  projectStatuses: WorkspaceStatus[];
  createdAt: string;
}

export interface Member {
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: User | null;
}

export interface PendingInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
  token: string;
  inviteUrl: string;
}

export type AuditAction =
  | 'member_invited'
  | 'member_added'
  | 'invite_revoked'
  | 'role_changed'
  | 'member_removed'
  | 'member_left'
  | 'workspace_renamed'
  | 'ownership_transferred';

export interface ActivityEntry {
  id: string;
  action: AuditAction;
  meta: Record<string, unknown>;
  createdAt: string;
  actor: User | null;
  target: User | null;
}

export type ProjectPriority = 'urgent' | 'high' | 'normal' | 'low';
/** A workspace-defined status key (e.g. 'active', 'on_hold', or a custom one). */
export type ProjectStatus = string;

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  priority: ProjectPriority;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
}

/** A workspace-defined status key (e.g. 'pending', 'in_progress', 'completed', or a custom one). */
export type TaskStatus = string;
export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string | null;
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
