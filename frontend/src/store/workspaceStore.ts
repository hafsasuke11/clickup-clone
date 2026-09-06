import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/utils/api';
import type { ActivityEntry, Member, PendingInvite, Workspace, WorkspaceRole } from '@/utils/types';

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
    role?: 'admin' | 'member',
  ) => Promise<{ status: 'added' | 'invited'; emailSent?: boolean; inviteUrl?: string }>;
  updateMemberRole: (userId: string, role: 'admin' | 'member') => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  transferOwnership: (userId: string) => Promise<void>;
  deleteWorkspace: () => Promise<void>;
  fetchActivity: () => Promise<void>;
  clearActivity: () => Promise<void>;
  reset: () => void;
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

      addMember: async (email, role) => {
        const ws = get().workspace;
        if (!ws) return { status: 'invited' as const };
        const res = await apiClient.post<{
          status: 'added' | 'invited';
          emailSent?: boolean;
          invite?: { inviteUrl?: string };
        }>(`/api/workspaces/${ws.id}/members`, { email, role });
        if (res.status === 'added') {
          await get().fetchMembers();
        } else {
          void get().fetchPendingInvites();
        }
        return { status: res.status, emailSent: res.emailSent, inviteUrl: res.invite?.inviteUrl };
      },

      updateMemberRole: async (userId, role) => {
        const ws = get().workspace;
        if (!ws) return;
        await apiClient.patch(`/api/workspaces/${ws.id}/members/${userId}`, { role });
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

export type { WorkspaceRole };
