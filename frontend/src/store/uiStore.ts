import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskStatus } from '@/utils/types';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UiStore {
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;

  /** A task the Board should scroll to and briefly highlight — set when the user
   *  clicks a task name in the Activity feed, consumed (cleared) by the Board. */
  highlightTaskId: string | null;
  setHighlightTaskId: (id: string | null) => void;

  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;

  createModalOpen: boolean;
  setCreateModalOpen: (v: boolean) => void;
  createModalDueDate: string | null;
  setCreateModalDueDate: (d: string | null) => void;
  /** Pre-selected status for the create modal's Task form — set by the List
   *  page's per-column "Add Task" button so the new task lands in that column. */
  createModalStatus: TaskStatus | null;
  setCreateModalStatus: (s: TaskStatus | null) => void;
  /** When true, the create modal offers Task only (no Project tab) — used by the
   *  Calendar's per-day "+" button, where creating a project makes no sense. */
  createModalTaskOnly: boolean;
  setCreateModalTaskOnly: (v: boolean) => void;

  inviteModalOpen: boolean;
  setInviteModalOpen: (v: boolean) => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;

  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      selectedTaskId: null,
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),

      highlightTaskId: null,
      setHighlightTaskId: (id) => set({ highlightTaskId: id }),

      searchOpen: false,
      setSearchOpen: (v) => set({ searchOpen: v }),

      createModalOpen: false,
      setCreateModalOpen: (v) => set({ createModalOpen: v }),
      createModalDueDate: null,
      setCreateModalDueDate: (d) => set({ createModalDueDate: d }),
      createModalStatus: null,
      setCreateModalStatus: (s) => set({ createModalStatus: s }),
      createModalTaskOnly: false,
      setCreateModalTaskOnly: (v) => set({ createModalTaskOnly: v }),

      inviteModalOpen: false,
      setInviteModalOpen: (v) => set({ inviteModalOpen: v }),

      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      toasts: [],
      addToast: (message, type = 'success') => {
        const id = crypto.randomUUID();
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), 3500);
      },
      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'clickup-ui',
      partialize: (s) => ({ sidebarOpen: s.sidebarOpen }),
    },
  ),
);
