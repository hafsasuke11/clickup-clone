/**
 * Built-in statuses every workspace starts with. Members can add, rename,
 * recolour and reorder statuses; the built-in ones (matched by `key`) can be
 * changed but not deleted, so code that special-cases `completed` keeps working.
 */
export const DEFAULT_TASK_STATUSES = [
  { key: 'pending', label: 'Pending', color: '#64748B', order: 0, builtIn: true },
  { key: 'in_progress', label: 'In Progress', color: '#3B82F6', order: 1, builtIn: true },
  { key: 'completed', label: 'Completed', color: '#22C55E', order: 2, builtIn: true },
];

export const DEFAULT_PROJECT_STATUSES = [
  { key: 'pending', label: 'Pending', color: '#64748B', order: 0, builtIn: true },
  { key: 'in_progress', label: 'In Progress', color: '#3B82F6', order: 1, builtIn: true },
  { key: 'completed', label: 'Completed', color: '#22C55E', order: 2, builtIn: true },
];

export const BUILTIN_TASK_STATUS_KEYS = DEFAULT_TASK_STATUSES.map((s) => s.key);
export const BUILTIN_PROJECT_STATUS_KEYS = DEFAULT_PROJECT_STATUSES.map((s) => s.key);

/** Fallback status a task/project is moved to when its status is deleted. */
export const FALLBACK_TASK_STATUS = 'pending';
export const FALLBACK_PROJECT_STATUS = 'pending';
