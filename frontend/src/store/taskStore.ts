import { create } from 'zustand';
import { apiClient, ApiError } from '@/utils/api';
import { useUiStore } from './uiStore';
import type { OverallActivityEntry, Project, Task, TaskActivityEntry, TaskPriority, TaskStatus } from '@/utils/types';

export type ProjectInput = Partial<Omit<Project, 'id' | 'workspaceId' | 'createdBy' | 'createdAt'>> & {
  name: string;
};

export interface DuplicateTaskInfo {
  id: string;
  name: string;
  status: string;
}

export type CreateTaskResult = { task: Task } | { duplicate: DuplicateTaskInfo } | { denied: true };

/** Pull a user-facing message off an API error — the server's own text (e.g. a
 *  "ask the owner" permission message) when it has one, else a fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.data && typeof err.data.error === 'string'
    ? err.data.error
    : fallback;
}

const isPermissionDenied = (err: unknown) =>
  err instanceof ApiError && err.status === 403 && err.data?.code === 'PERMISSION_DENIED';

/** Client-side duplicate check against the tasks already loaded (every member's
 *  tasks are fetched, so this catches most cases instantly). The server repeats
 *  the check authoritatively on create. */
export function findDuplicateTask(
  tasks: Task[],
  name: string,
  projectId: string | null,
): Task | undefined {
  const n = name.trim().toLowerCase();
  const pid = projectId ?? null;
  return tasks.find((t) => (t.projectId ?? null) === pid && t.name.trim().toLowerCase() === n);
}

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
    // 'created' is the manual drag-and-drop order: `order` first, creation time as tiebreak.
    else cmp = (a.order - b.order) || a.createdAt.localeCompare(b.createdAt);
    return state.sortAsc ? cmp : -cmp;
  });
}

interface TaskStore {
  tasks: Task[];
  projects: Project[];
  taskActivity: TaskActivityEntry[];
  taskActivityLoaded: boolean;
  /** App-wide activity timeline (task activity + audit log) for the Activity page. */
  overallActivity: OverallActivityEntry[];
  overallActivityLoaded: boolean;
  loading: boolean;
  initialized: boolean;

  fetchTasks: (workspaceId: string) => Promise<void>;
  fetchProjects: (workspaceId: string) => Promise<void>;
  fetchTaskActivity: (workspaceId: string) => Promise<void>;
  fetchOverallActivity: (workspaceId: string) => Promise<void>;
  /** Delete rows from the app-wide activity timeline. Each entry is routed to
   *  the right log by its `source`. Resolves to the `source:id` keys removed. */
  deleteOverallActivityEntries: (
    workspaceId: string,
    entries: { id: string; source: 'task' | 'audit' }[],
  ) => Promise<string[]>;
  /** Delete activity entries — for one project, or all of them when `projectId`
   *  is omitted. */
  clearTaskActivity: (workspaceId: string, projectId?: string) => Promise<void>;
  /** Remove specific activity-feed rows by id. Only the activity records are
   *  deleted — the tasks/projects that produced them are untouched. Resolves to
   *  the ids that were actually removed. */
  deleteTaskActivityEntries: (workspaceId: string, ids: string[]) => Promise<string[]>;

  /** Creates a task, unless an identically-named task already exists in the same
   *  project — then it resolves to `{ duplicate }` and creates nothing. Pass
   *  `{ force: true }` to add it anyway. */
  createTask: (workspaceId: string, data: {
    name: string; description?: string; status?: TaskStatus; priority?: TaskPriority;
    dueDate?: string | null; assigneeId?: string | null; projectId?: string | null;
  }, opts?: { force?: boolean }) => Promise<CreateTaskResult>;
  updateTask: (workspaceId: string, taskId: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (workspaceId: string, taskId: string) => Promise<void>;
  /** Persist a manual card order for one status column (Board / List drag-and-drop).
   *  `orderedIds` is the full ordered id list for `status`; every task in it is
   *  moved onto `status`, covering a card dragged in from another column. */
  reorderTasks: (workspaceId: string, status: TaskStatus, orderedIds: string[]) => Promise<void>;

  createProject: (workspaceId: string, data: ProjectInput) => Promise<Project | null>;
  updateProject: (workspaceId: string, projectId: string, patch: Partial<ProjectInput>) => Promise<void>;
  deleteProject: (workspaceId: string, projectId: string) => Promise<void>;
  /** Persist a manual project order (Projects page drag-and-drop). */
  reorderProjects: (workspaceId: string, orderedIds: string[]) => Promise<void>;

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
  taskActivity: [],
  taskActivityLoaded: false,
  overallActivity: [],
  overallActivityLoaded: false,
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

  fetchTaskActivity: async (workspaceId) => {
    try {
      const { activity } = await apiClient.get<{ activity: TaskActivityEntry[] }>(
        `/api/workspaces/${workspaceId}/task-activity`,
      );
      set({ taskActivity: activity, taskActivityLoaded: true });
    } catch (err) {
      console.error('fetchTaskActivity error:', err);
      set({ taskActivityLoaded: true });
    }
  },

  fetchOverallActivity: async (workspaceId) => {
    try {
      const { activity } = await apiClient.get<{ activity: OverallActivityEntry[] }>(
        `/api/workspaces/${workspaceId}/overall-activity`,
      );
      set({ overallActivity: activity, overallActivityLoaded: true });
    } catch (err) {
      console.error('fetchOverallActivity error:', err);
      set({ overallActivityLoaded: true });
    }
  },

  deleteOverallActivityEntries: async (workspaceId, entries) => {
    if (entries.length === 0) return [];
    const keyOf = (e: { id: string; source: string }) => `${e.source}:${e.id}`;
    const keySet = new Set(entries.map(keyOf));
    const prev = get().overallActivity;
    // Optimistic: drop them from the feed straight away.
    set((s) => ({ overallActivity: s.overallActivity.filter((e) => !keySet.has(keyOf(e))) }));

    const taskIds = entries.filter((e) => e.source === 'task').map((e) => e.id);
    const auditIds = entries.filter((e) => e.source === 'audit').map((e) => e.id);
    const empty = Promise.resolve({ deleted: 0, ids: [] as string[] });
    try {
      const [taskRes, auditRes] = await Promise.all([
        taskIds.length
          ? apiClient.del<{ deleted: number; ids: string[] }>(
              `/api/workspaces/${workspaceId}/task-activity/entries`, { ids: taskIds },
            )
          : empty,
        auditIds.length
          ? apiClient.del<{ deleted: number; ids: string[] }>(
              `/api/workspaces/${workspaceId}/activity/entries`, { ids: auditIds },
            )
          : empty,
      ]);
      const removed = new Set([
        ...taskRes.ids.map((id) => `task:${id}`),
        ...auditRes.ids.map((id) => `audit:${id}`),
      ]);
      // Restore any the server refused (not yours to delete).
      const missed = prev.filter((e) => keySet.has(keyOf(e)) && !removed.has(keyOf(e)));
      if (missed.length > 0) {
        set((s) => ({
          overallActivity: [...s.overallActivity, ...missed].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        }));
        useUiStore.getState().addToast(
          `${missed.length} activit${missed.length === 1 ? 'y' : 'ies'} couldn't be removed`,
          'error',
        );
      }
      return [...removed];
    } catch (err) {
      set({ overallActivity: prev });
      useUiStore.getState().addToast('Failed to delete activity', 'error');
      console.error('deleteOverallActivityEntries error:', err);
      return [];
    }
  },

  clearTaskActivity: async (workspaceId, projectId) => {
    const prev = get().taskActivity;
    set((s) => ({
      taskActivity: projectId ? s.taskActivity.filter((e) => e.projectId !== projectId) : [],
    }));
    try {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      await apiClient.del(`/api/workspaces/${workspaceId}/task-activity${q}`);
    } catch (err) {
      set({ taskActivity: prev });
      useUiStore.getState().addToast('Failed to clear activity', 'error');
      console.error('clearTaskActivity error:', err);
    }
  },

  deleteTaskActivityEntries: async (workspaceId, ids) => {
    if (ids.length === 0) return [];
    const prev = get().taskActivity;
    const idSet = new Set(ids);
    // Optimistic: drop them from the feed straight away.
    set((s) => ({ taskActivity: s.taskActivity.filter((e) => !idSet.has(e.id)) }));
    try {
      const { ids: deleted } = await apiClient.del<{ deleted: number; ids: string[] }>(
        `/api/workspaces/${workspaceId}/task-activity/entries`,
        { ids },
      );
      // Restore any the server didn't actually remove (e.g. not yours to delete).
      const kept = new Set(deleted);
      const missed = prev.filter((e) => idSet.has(e.id) && !kept.has(e.id));
      if (missed.length > 0) {
        set((s) => ({
          taskActivity: [...s.taskActivity, ...missed].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }));
        useUiStore.getState().addToast(
          `${missed.length} activit${missed.length === 1 ? 'y' : 'ies'} couldn't be removed`,
          'error',
        );
      }
      return deleted;
    } catch (err) {
      set({ taskActivity: prev });
      useUiStore.getState().addToast('Failed to delete activity', 'error');
      console.error('deleteTaskActivityEntries error:', err);
      return [];
    }
  },

  createTask: async (workspaceId, data, opts) => {
    let task: Task;
    try {
      const res = await apiClient.post<{ task: Task }>(
        `/api/workspaces/${workspaceId}/tasks`,
        { ...data, force: opts?.force ?? false },
      );
      task = res.task;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data && err.data.code === 'DUPLICATE_TASK') {
        return { duplicate: err.data.existing as DuplicateTaskInfo };
      }
      if (isPermissionDenied(err)) {
        useUiStore.getState().addToast(apiErrorMessage(err, 'Not allowed'), 'error');
        return { denied: true };
      }
      throw err;
    }
    set((s) => ({ tasks: [task, ...s.tasks] }));
    useUiStore.getState().addToast(`Task "${task.name}" created`, 'success');
    if (get().taskActivityLoaded) void get().fetchTaskActivity(workspaceId);
    return { task };
  },

  updateTask: async (workspaceId, taskId, patch) => {
    const prev = get().tasks.find((t) => t.id === taskId);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }));
    try {
      const { task } = await apiClient.patch<{ task: Task }>(`/api/workspaces/${workspaceId}/tasks/${taskId}`, patch);
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? task : t)) }));
      if (get().taskActivityLoaded) void get().fetchTaskActivity(workspaceId);
    } catch (err) {
      if (prev) set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? prev : t)) }));
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to update task'), 'error');
      console.error('updateTask error:', err);
    }
  },

  reorderTasks: async (workspaceId, status, orderedIds) => {
    const prev = get().tasks;
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    set((s) => ({
      tasks: s.tasks.map((t) =>
        rank.has(t.id) ? { ...t, status, order: rank.get(t.id)! } : t,
      ),
    }));
    try {
      const { tasks } = await apiClient.put<{ tasks: Task[] }>(
        `/api/workspaces/${workspaceId}/tasks/reorder`,
        { status, ids: orderedIds },
      );
      set({ tasks });
      if (get().taskActivityLoaded) void get().fetchTaskActivity(workspaceId);
    } catch (err) {
      set({ tasks: prev });
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to reorder tasks'), 'error');
      console.error('reorderTasks error:', err);
    }
  },

  deleteTask: async (workspaceId, taskId) => {
    const prev = get().tasks.find((t) => t.id === taskId);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
    try {
      await apiClient.del(`/api/workspaces/${workspaceId}/tasks/${taskId}`);
      useUiStore.getState().addToast('Task deleted', 'info');
      if (get().taskActivityLoaded) void get().fetchTaskActivity(workspaceId);
    } catch (err) {
      if (prev) set((s) => ({ tasks: [...s.tasks, prev] }));
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to delete task'), 'error');
      console.error('deleteTask error:', err);
    }
  },

  createProject: async (workspaceId, data) => {
    try {
      const { project } = await apiClient.post<{ project: Project }>(`/api/workspaces/${workspaceId}/projects`, data);
      set((s) => ({ projects: [...s.projects, project] }));
      return project;
    } catch (err) {
      if (isPermissionDenied(err)) {
        useUiStore.getState().addToast(apiErrorMessage(err, 'Not allowed'), 'error');
        return null;
      }
      throw err;
    }
  },

  updateProject: async (workspaceId, projectId, patch) => {
    const prev = get().projects.find((p) => p.id === projectId);
    set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p)) }));
    try {
      const { project } = await apiClient.patch<{ project: Project }>(`/api/workspaces/${workspaceId}/projects/${projectId}`, patch);
      set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? project : p)) }));
    } catch (err) {
      if (prev) set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? prev : p)) }));
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to update project'), 'error');
      console.error('updateProject error:', err);
    }
  },

  reorderProjects: async (workspaceId, orderedIds) => {
    const prev = get().projects;
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    set((s) => ({
      projects: s.projects.map((p) =>
        rank.has(p.id) ? { ...p, order: rank.get(p.id)! } : p,
      ),
    }));
    try {
      const { projects } = await apiClient.put<{ projects: Project[] }>(
        `/api/workspaces/${workspaceId}/projects/reorder`,
        { ids: orderedIds },
      );
      set({ projects });
    } catch (err) {
      set({ projects: prev });
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to reorder projects'), 'error');
      console.error('reorderProjects error:', err);
    }
  },

  deleteProject: async (workspaceId, projectId) => {
    const prevProjects = get().projects;
    const prevTasks = get().tasks;
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== projectId),
      tasks: s.tasks.map((t) => (t.projectId === projectId ? { ...t, projectId: null } : t)),
    }));
    try {
      await apiClient.del(`/api/workspaces/${workspaceId}/projects/${projectId}`);
      useUiStore.getState().addToast('Project deleted', 'info');
    } catch (err) {
      set({ projects: prevProjects, tasks: prevTasks });
      useUiStore.getState().addToast(apiErrorMessage(err, 'Failed to delete project'), 'error');
      console.error('deleteProject error:', err);
    }
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

  reset: () => set({
    tasks: [], projects: [], taskActivity: [], taskActivityLoaded: false,
    overallActivity: [], overallActivityLoaded: false,
    loading: false, initialized: false,
  }),
}));
