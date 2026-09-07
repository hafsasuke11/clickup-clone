import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { apiClient } from '@/utils/api';
import type {
  ActivityEntry,
  Member,
  MemberPermissions,
  PendingInvite,
  StatusKind,
  Workspace,
  WorkspaceRole,
  WorkspaceStatus,
} from '@/utils/types';
import { useTaskStore } from './taskStore';
import { useUiStore } from './uiStore';

const STATUS_FIELD: Record<StatusKind, 'taskStatuses' | 'projectStatuses'> = {
  task: 'taskStatuses',
  project: 'projectStatuses',
};

interface WorkspaceStore {
  workspaces: Workspace[];
  /** Last-used workspace per user id — persisted, so each account on a shared
   *  browser returns to its own workspace. */
  activeWorkspaceIdByUser: Record<string, string>;
  /** The user whose workspaces are currently loaded (not persisted). */
  currentUserId: string | null;
  workspace: Workspace | null;
  members: Member[];
  pendingInvites: PendingInvite[];
  activity: ActivityEntry[];
  loading: boolean;
  initialized: boolean;

  fetchWorkspaces: (userId?: string) => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchPendingInvites: () => Promise<void>;
  revokeInvite: (inviteId: string) => Promise<void>;
  renameWorkspace: (name: string) => Promise<void>;
  addMember: (
    email: string,
  ) => Promise<{ status: 'added' | 'invited'; emailSent?: boolean; inviteUrl?: string }>;
  updateMemberPermissions: (userId: string, permissions: Partial<MemberPermissions>) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  transferOwnership: (userId: string) => Promise<void>;
  deleteWorkspace: () => Promise<void>;
  fetchActivity: () => Promise<void>;
  clearActivity: () => Promise<void>;

  addStatus: (kind: StatusKind, label: string, color: string) => Promise<void>;
  updateStatus: (kind: StatusKind, key: string, patch: { label?: string; color?: string }) => Promise<void>;
  deleteStatus: (kind: StatusKind, key: string) => Promise<void>;
  reorderStatuses: (kind: StatusKind, keys: string[]) => Promise<void>;

  reset: () => void;
}

function applyStatuses(kind: StatusKind, statuses: WorkspaceStatus[]) {
  const field = STATUS_FIELD[kind];
  useWorkspaceStore.setState((s) => ({
    workspace: s.workspace ? { ...s.workspace, [field]: statuses } : s.workspace,
    workspaces: s.workspaces.map((w) =>
      w.id === s.workspace?.id ? { ...w, [field]: statuses } : w,
    ),
  }));
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceIdByUser: {},
      currentUserId: null,
      workspace: null,
      members: [],
      pendingInvites: [],
      activity: [],
      loading: false,
      initialized: false,

      fetchWorkspaces: async (userId) => {
        const uid = userId ?? get().currentUserId ?? null;
        set({ loading: true, currentUserId: uid });
        try {
          const { workspaces } = await apiClient.get<{ workspaces: Workspace[] }>('/api/workspaces');
          const preferredId = uid ? get().activeWorkspaceIdByUser[uid] : undefined;
          const active = workspaces.find((w) => w.id === preferredId) ?? workspaces[0] ?? null;

          set((s) => ({
            workspaces,
            workspace: active,
            currentUserId: uid,
            activeWorkspaceIdByUser:
              active && uid ? { ...s.activeWorkspaceIdByUser, [uid]: active.id } : s.activeWorkspaceIdByUser,
            loading: false,
            initialized: true,
          }));
          if (active) {
            await get().fetchMembers();
            void get().fetchPendingInvites();
          }
        } catch (err) {
          console.error('fetchWorkspaces error:', err);
          set({ loading: false, initialized: true });
        }
      },

      switchWorkspace: async (id) => {
        const target = get().workspaces.find((w) => w.id === id);
        if (!target) return;
        const uid = get().currentUserId;
        set((s) => ({
          workspace: target,
          activeWorkspaceIdByUser: uid ? { ...s.activeWorkspaceIdByUser, [uid]: id } : s.activeWorkspaceIdByUser,
          members: [],
          pendingInvites: [],
          activity: [],
        }));
        await get().fetchMembers();
        void get().fetchPendingInvites();
      },

      fetchMembers: async () => {
        const ws = get().workspace;
        if (!ws) return;
        const { members } = await apiClient.get<{ members: Member[] }>(`/api/workspaces/${ws.id}/members`);
        set({ members });
      },

      fetchPendingInvites: async () => {
        const ws = get().workspace;
        if (!ws) return;
        try {
          const { invites } = await apiClient.get<{ invites: PendingInvite[] }>(`/api/workspaces/${ws.id}/invites`);
          set({ pendingInvites: invites });
        } catch {
          // Non-owners/admins can't view invites — that's fine, just leave the list empty.
        }
      },

      revokeInvite: async (inviteId) => {
        const ws = get().workspace;
        if (!ws) return;
        await apiClient.del(`/api/workspaces/${ws.id}/invites/${inviteId}`);
        set((s) => ({ pendingInvites: s.pendingInvites.filter((i) => i.id !== inviteId) }));
      },

      renameWorkspace: async (name) => {
        const ws = get().workspace;
        if (!ws) return;
        const { workspace } = await apiClient.patch<{ workspace: Workspace }>(`/api/workspaces/${ws.id}`, { name });
        set((s) => ({
          workspace,
          workspaces: s.workspaces.map((w) => (w.id === workspace.id ? workspace : w)),
        }));
      },

      addMember: async (email) => {
        const ws = get().workspace;
        if (!ws) return { status: 'invited' as const };
        const res = await apiClient.post<{
          status: 'added' | 'invited';
          emailSent?: boolean;
          invite?: { inviteUrl?: string };
        }>(`/api/workspaces/${ws.id}/members`, { email });
        if (res.status === 'added') {
          await get().fetchMembers();
        } else {
          void get().fetchPendingInvites();
        }
        return { status: res.status, emailSent: res.emailSent, inviteUrl: res.invite?.inviteUrl };
      },

      updateMemberPermissions: async (userId, permissions) => {
        const ws = get().workspace;
        if (!ws) return;
        await apiClient.patch(`/api/workspaces/${ws.id}/members/${userId}/permissions`, { permissions });
        await get().fetchMembers();
      },

      removeMember: async (userId) => {
        const ws = get().workspace;
        if (!ws) return;
        await apiClient.del(`/api/workspaces/${ws.id}/members/${userId}`);
        set((s) => ({ members: s.members.filter((m) => m.userId !== userId) }));
      },

      transferOwnership: async (userId) => {
        const ws = get().workspace;
        if (!ws) return;
        const { workspace } = await apiClient.post<{ workspace: Workspace }>(`/api/workspaces/${ws.id}/transfer-ownership`, { newOwnerId: userId });
        set((s) => ({
          workspace,
          workspaces: s.workspaces.map((w) => (w.id === workspace.id ? workspace : w)),
        }));
        await get().fetchMembers();
      },

      deleteWorkspace: async () => {
        const ws = get().workspace;
        if (!ws) return;
        await apiClient.del(`/api/workspaces/${ws.id}`);
        set((s) => ({
          workspaces: s.workspaces.filter((w) => w.id !== ws.id),
          workspace: null,
          members: [],
          pendingInvites: [],
          activity: [],
        }));
        await get().fetchWorkspaces();
      },

      fetchActivity: async () => {
        const ws = get().workspace;
        if (!ws) return;
        try {
          const { activity } = await apiClient.get<{ activity: ActivityEntry[] }>(`/api/workspaces/${ws.id}/activity`);
          set({ activity });
        } catch {
          // Non-owners/admins can't view activity, leave the list empty.
        }
      },

      clearActivity: async () => {
        const ws = get().workspace;
        if (!ws) return;
        await apiClient.del(`/api/workspaces/${ws.id}/activity`);
        set({ activity: [] });
      },

      addStatus: async (kind, label, color) => {
        const ws = get().workspace;
        if (!ws) return;
        const { statuses } = await apiClient.post<{ statuses: WorkspaceStatus[] }>(
          `/api/workspaces/${ws.id}/statuses/${kind}`,
          { label, color },
        );
        applyStatuses(kind, statuses);
        useUiStore.getState().addToast(`Status "${label}" added`, 'success');
      },

      updateStatus: async (kind, key, patch) => {
        const ws = get().workspace;
        if (!ws) return;
        const { statuses } = await apiClient.patch<{ statuses: WorkspaceStatus[] }>(
          `/api/workspaces/${ws.id}/statuses/${kind}/${key}`,
          patch,
        );
        applyStatuses(kind, statuses);
      },

      deleteStatus: async (kind, key) => {
        const ws = get().workspace;
        if (!ws) return;
        const { statuses, reassigned } = await apiClient.del<{ statuses: WorkspaceStatus[]; reassigned: number }>(
          `/api/workspaces/${ws.id}/statuses/${kind}/${key}`,
        );
        applyStatuses(kind, statuses);
        // The server moved affected items onto the fallback status — refresh them.
        if (kind === 'task') void useTaskStore.getState().fetchTasks(ws.id);
        else void useTaskStore.getState().fetchProjects(ws.id);
        useUiStore.getState().addToast(
          reassigned > 0 ? `Status deleted — ${reassigned} item(s) moved` : 'Status deleted',
          'info',
        );
      },

      reorderStatuses: async (kind, keys) => {
        const ws = get().workspace;
        if (!ws) return;
        const field = STATUS_FIELD[kind];
        const prev = ws[field];
        // Optimistic: reorder locally right away.
        const reordered = [...prev].sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key))
          .map((s, i) => ({ ...s, order: i }));
        applyStatuses(kind, reordered);
        try {
          const { statuses } = await apiClient.put<{ statuses: WorkspaceStatus[] }>(
            `/api/workspaces/${ws.id}/statuses/${kind}/reorder`,
            { keys },
          );
          applyStatuses(kind, statuses);
        } catch (err) {
          applyStatuses(kind, prev);
          useUiStore.getState().addToast('Failed to reorder statuses', 'error');
          console.error('reorderStatuses error:', err);
        }
      },

      reset: () =>
        set({
          workspaces: [],
          workspace: null,
          members: [],
          pendingInvites: [],
          activity: [],
          loading: false,
          initialized: false,
          currentUserId: null,
        }),
    }),
    {
      name: 'clickup-workspace',
      version: 1,
      // v0 persisted a single global `activeWorkspaceId`; drop it and start the
      // per-user map fresh (first login just defaults to the user's first ws).
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as { activeWorkspaceIdByUser?: Record<string, string> };
        return { activeWorkspaceIdByUser: p.activeWorkspaceIdByUser ?? {} } as WorkspaceStore;
      },
      partialize: (s) => ({ activeWorkspaceIdByUser: s.activeWorkspaceIdByUser }),
    },
  ),
);

const FALLBACK_TASK_STATUSES: WorkspaceStatus[] = [
  { key: 'pending', label: 'Pending', color: '#64748B', order: 0, builtIn: true },
  { key: 'in_progress', label: 'In Progress', color: '#3B82F6', order: 1, builtIn: true },
  { key: 'completed', label: 'Completed', color: '#22C55E', order: 2, builtIn: true },
];
const FALLBACK_PROJECT_STATUSES: WorkspaceStatus[] = [
  { key: 'pending', label: 'Pending', color: '#64748B', order: 0, builtIn: true },
  { key: 'in_progress', label: 'In Progress', color: '#3B82F6', order: 1, builtIn: true },
  { key: 'completed', label: 'Completed', color: '#22C55E', order: 2, builtIn: true },
];

const sortByOrder = (list: WorkspaceStatus[]) => [...list].sort((a, b) => a.order - b.order);

/** Sorted task statuses for the active workspace (falls back to built-ins). */
export function useTaskStatuses(): WorkspaceStatus[] {
  return useWorkspaceStore(
    useShallow((s) =>
      s.workspace?.taskStatuses?.length ? sortByOrder(s.workspace.taskStatuses) : FALLBACK_TASK_STATUSES,
    ),
  );
}

/** Sorted project statuses for the active workspace (falls back to built-ins). */
export function useProjectStatuses(): WorkspaceStatus[] {
  return useWorkspaceStore(
    useShallow((s) =>
      s.workspace?.projectStatuses?.length ? sortByOrder(s.workspace.projectStatuses) : FALLBACK_PROJECT_STATUSES,
    ),
  );
}

/** Sorted statuses for the given kind — `kind` is an argument, not a conditional hook. */
export function useStatuses(kind: StatusKind): WorkspaceStatus[] {
  return useWorkspaceStore(
    useShallow((s) => {
      const list = kind === 'task' ? s.workspace?.taskStatuses : s.workspace?.projectStatuses;
      if (list?.length) return sortByOrder(list);
      return kind === 'task' ? FALLBACK_TASK_STATUSES : FALLBACK_PROJECT_STATUSES;
    }),
  );
}

export type { WorkspaceRole };
