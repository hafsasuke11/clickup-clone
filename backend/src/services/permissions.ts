/**
 * Workspace permissions. A workspace has exactly one Owner (full control) and
 * any number of Members. Members can view everything but can't change anything
 * until the Owner grants them specific permissions.
 */
export const PERMISSION_KEYS = [
  'manageTasks',
  'assignTasks',
  'manageProjects',
  'deleteItems',
  'manageMembers',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionSet = Record<PermissionKey, boolean>;

/** Human phrasing used in "you don't have permission to ___" messages. */
export const PERMISSION_ACTION: Record<PermissionKey, string> = {
  manageTasks: 'create or edit tasks',
  assignTasks: 'assign tasks',
  manageProjects: 'create or edit projects',
  deleteItems: 'delete tasks or projects',
  manageMembers: 'manage members',
};

export const NO_PERMISSIONS: PermissionSet = {
  manageTasks: false,
  assignTasks: false,
  manageProjects: false,
  deleteItems: false,
  manageMembers: false,
};

export const ALL_PERMISSIONS: PermissionSet = {
  manageTasks: true,
  assignTasks: true,
  manageProjects: true,
  deleteItems: true,
  manageMembers: true,
};

/** The permissions a member actually has: an Owner always has everything. */
export function effectivePermissions(member: { role?: string; permissions?: unknown }): PermissionSet {
  if (member.role === 'owner') return { ...ALL_PERMISSIONS };
  const p = (member.permissions && typeof member.permissions === 'object'
    ? member.permissions
    : {}) as Record<string, unknown>;
  const out = { ...NO_PERMISSIONS };
  for (const k of PERMISSION_KEYS) out[k] = p[k] === true;
  return out;
}

/** Normalize an arbitrary object into a full, boolean permission set. */
export function normalizePermissions(input: unknown): PermissionSet {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out = { ...NO_PERMISSIONS };
  for (const k of PERMISSION_KEYS) out[k] = src[k] === true;
  return out;
}
