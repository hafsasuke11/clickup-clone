import { create } from 'zustand';
import { apiClient } from '@/utils/api';
import { useUiStore } from './uiStore';
import type { Project, Task, TaskPriority, TaskStatus } from '@/utils/types';

export type TaskSortKey = 'name' | 'dueDate' | 'priority' | 'created';

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function getVisibleTasks(state: {
  tasks: Task[];
  filterPriorities: TaskPriority[];
  filterAssigneeIds: string[];
  sortKey: TaskSortKey;
  sortAsc: boolean;
}): Task[] {
  const filtered = state.tasks.filter((t) => {
    if (state.filterPriorities.length && !state.filterPriorities.includes(t.priority)) return false;
    if (state.filterAssigneeIds.length && !state.filterAssigneeIds.includes(t.assigneeId ?? '')) return false;
    return true;
  });
  return [...filtered].sort((a, b) => {
    let cmp = 0;
    if (state.sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (state.sortKey === 'priority') cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    else if (state.sortKey === 'dueDate') cmp = (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99');
    else cmp = a.createdAt.localeCompare(b.createdAt);
    return state.sortAsc ? cmp : -cmp;
  });
}

interface TaskStore {
  tasks: Task[];
  projects: Project[];
  loading: boolean;
  initialized: boolean;

  fetchTasks: (workspaceId: string) => Promise<void>;
  fetchProjects: (workspaceId: string) => Promise<void>;

  createTask: (workspaceId: string, data: {
    name: string; description?: string; status?: TaskStatus; priority?: TaskPriority;
    dueDate?: string | null; assigneeId?: string | null; projectId?: string | null;
  }) => Promise<Task>;
  updateTask: (workspaceId: string, taskId: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (workspaceId: string, taskId: string) => Promise<void>;

  createProject: (workspaceId: string, name: string, color?: string) => Promise<Project>;

  filterPriorities: TaskPriority[];
  toggleFilterPriority: (p: TaskPriority) => void;
  filterAssigneeIds: string[];
  toggleFilterAssigneeId: (id: string) => void;
  clearTaskFilters: () => void;
  sortKey: TaskSortKey;
  setSortKey: (k: TaskSortKey) => void;
  sortAsc: boolean;
  toggleSortAsc: () => void;

  reset: () => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  projects: [],
  loading: false,
  initialized: false,

  fetchTasks: async (workspaceId) => {
    set({ loading: true });
    try {
      const { tasks } = await apiClient.get<{ tasks: Task[] }>(`/api/workspaces/${workspaceId}/tasks`);
      set({ tasks, loading: false, initialized: true });
    } catch (err) {
      console.error('fetchTasks error:', err);
      set({ loading: false, initialized: true });
    }
  },

  fetchProjects: async (workspaceId) => {
    const { projects } = await apiClient.get<{ projects: Project[] }>(`/api/workspaces/${workspaceId}/projects`);
    set({ projects });
  },

  createTask: async (workspaceId, data) => {
    const { task } = await apiClient.post<{ task: Task }>(`/api/workspaces/${workspaceId}/tasks`, data);
    set((s) => ({ tasks: [task, ...s.tasks] }));
    useUiStore.getState().addToast(`Task "${task.name}" created`, 'success');
    return task;
  },

  updateTask: async (workspaceId, taskId, patch) => {
    const prev = get().tasks.find((t) => t.id === taskId);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }));
    try {
      const { task } = await apiClient.patch<{ task: Task }>(`/api/workspaces/${workspaceId}/tasks/${taskId}`, patch);
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? task : t)) }));
    } catch (err) {
      if (prev) set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? prev : t)) }));
      useUiStore.getState().addToast('Failed to update task', 'error');
      console.error('updateTask error:', err);
    }
  },

  deleteTask: async (workspaceId, taskId) => {
    const prev = get().tasks.find((t) => t.id === taskId);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
    try {
      await apiClient.del(`/api/workspaces/${workspaceId}/tasks/${taskId}`);
      useUiStore.getState().addToast('Task deleted', 'info');
    } catch (err) {
      if (prev) set((s) => ({ tasks: [...s.tasks, prev] }));
      useUiStore.getState().addToast('Failed to delete task', 'error');
      console.error('deleteTask error:', err);
    }
  },

  createProject: async (workspaceId, name, color) => {
    const { project } = await apiClient.post<{ project: Project }>(`/api/workspaces/${workspaceId}/projects`, { name, color });
    set((s) => ({ projects: [...s.projects, project] }));
    return project;
  },

  filterPriorities: [],
  toggleFilterPriority: (p) => set((s) => ({
    filterPriorities: s.filterPriorities.includes(p) ? s.filterPriorities.filter((x) => x !== p) : [...s.filterPriorities, p],
  })),
  filterAssigneeIds: [],
  toggleFilterAssigneeId: (id) => set((s) => ({
    filterAssigneeIds: s.filterAssigneeIds.includes(id) ? s.filterAssigneeIds.filter((x) => x !== id) : [...s.filterAssigneeIds, id],
  })),
  clearTaskFilters: () => set({ filterPriorities: [], filterAssigneeIds: [] }),
  sortKey: 'created',
  setSortKey: (k) => set({ sortKey: k }),
  sortAsc: true,
  toggleSortAsc: () => set((s) => ({ sortAsc: !s.sortAsc })),

  reset: () => set({ tasks: [], projects: [], loading: false, initialized: false }),
}));
