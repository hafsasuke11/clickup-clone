import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { Member, PermissionKey } from './types';

export const PERMISSION_META: { key: PermissionKey; label: string; hint: string }[] = [
  { key: 'manageTasks', label: 'Create & edit tasks', hint: 'Add tasks and change task details, status, priority and due dates.' },
  { key: 'assignTasks', label: 'Assign tasks', hint: 'Set or change who a task is assigned to.' },
  { key: 'manageProjects', label: 'Create & edit projects', hint: 'Add projects and change project details.' },
  { key: 'deleteItems', label: 'Delete tasks & projects', hint: 'Permanently remove tasks and projects.' },
  { key: 'manageMembers', label: 'Manage members', hint: 'Invite and remove workspace members.' },
];

/** The current user's membership in the active workspace (null if not loaded). */
export function useMyMembership(): Member | null {
  const userId = useAuthStore((s) => s.user?.id);
  return useWorkspaceStore((s) => s.members.find((m) => m.userId === userId) ?? null);
}

export function useIsOwner(): boolean {
  return useMyMembership()?.role === 'owner';
}

/** Whether the current user is allowed to perform `key`. Owners always can. */
export function useCan(key: PermissionKey): boolean {
  const m = useMyMembership();
  if (!m) return false;
  if (m.role === 'owner') return true;
  return Boolean(m.effectivePermissions?.[key]);
}

/** A short "ask the owner" message for a blocked action. */
export const permissionMessage = (label: string) =>
  `You don't have permission to ${label}. Ask the workspace owner for access.`;
