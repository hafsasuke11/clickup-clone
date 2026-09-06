import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UiStore {
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;

  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;

  createModalOpen: boolean;
  setCreateModalOpen: (v: boolean) => void;
  createModalDueDate: string | null;
  setCreateModalDueDate: (d: string | null) => void;

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

      searchOpen: false,
      setSearchOpen: (v) => set({ searchOpen: v }),

      createModalOpen: false,
      setCreateModalOpen: (v) => set({ createModalOpen: v }),
      createModalDueDate: null,
      setCreateModalDueDate: (d) => set({ createModalDueDate: d }),

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
