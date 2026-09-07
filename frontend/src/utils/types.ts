export interface User {
  id: string;
  email: string;
  fullName: string;
  company: string;
  createdAt: string;
}

export type WorkspaceRole = 'owner' | 'member';

export const PERMISSION_KEYS = [
  'manageTasks',
  'assignTasks',
  'manageProjects',
  'deleteItems',
  'manageMembers',
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type MemberPermissions = Record<PermissionKey, boolean>;

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
  /** Grants the owner has toggled on for this member (all false for an owner). */
  permissions: MemberPermissions;
  /** What the member can actually do — an owner always has everything. */
  effectivePermissions: MemberPermissions;
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
  | 'ownership_transferred'
  | 'permissions_changed'
  | 'project_created'
  | 'project_deleted';

export interface ActivityEntry {
  id: string;
  action: AuditAction;
  meta: Record<string, unknown>;
  createdAt: string;
  actor: User | null;
  target: User | null;
}

export type TaskActivityAction =
  | 'task_created'
  | 'task_renamed'
  | 'task_status_changed'
  | 'task_completed'
  | 'task_reopened'
  | 'task_assigned'
  | 'task_unassigned'
  | 'task_priority_changed'
  | 'task_due_changed'
  | 'task_moved'
  | 'task_description_changed'
  | 'task_deleted';

export interface TaskActivityEntry {
  id: string;
  action: TaskActivityAction;
  taskId: string | null;
  taskName: string;
  projectId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  actor: User | null;
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
  order: number;
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
  order: number;
  dueDate: string | null;
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
