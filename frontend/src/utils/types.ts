export interface User {
  id: string;
  email: string;
  fullName: string;
  company: string;
  createdAt: string;
  /** Whether the account has an authenticator app (TOTP) enrolled. */
  twoFactorEnabled?: boolean;
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
  | 'project_updated'
  | 'project_deleted'
  | 'status_created'
  | 'status_updated'
  | 'status_deleted';

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

/**
 * One row of the app-wide activity timeline (Activity page), from
 * `GET /api/workspaces/:id/overall-activity`. It is either a task activity
 * (`source: 'task'`) or an audit-log entry (`source: 'audit'`) — project,
 * status, member, permission and workspace changes.
 */
export interface OverallActivityEntry {
  id: string;
  source: 'task' | 'audit';
  action: TaskActivityAction | AuditAction;
  actor: User | null;
  createdAt: string;
  meta: Record<string, unknown>;
  /** Present on `source: 'task'` rows. */
  taskId?: string | null;
  taskName?: string | null;
  projectId?: string | null;
  /** Present on `source: 'audit'` rows that name another member. */
  target?: User | null;
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
