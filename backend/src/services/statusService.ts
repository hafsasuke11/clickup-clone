import { Workspace } from '../models/Workspace.js';
import {
  DEFAULT_PROJECT_STATUSES,
  DEFAULT_TASK_STATUSES,
} from '../models/statusDefaults.js';

type StatusKind = 'task' | 'project';

const FIELD = { task: 'taskStatuses', project: 'projectStatuses' } as const;
const DEFAULTS = { task: DEFAULT_TASK_STATUSES, project: DEFAULT_PROJECT_STATUSES } as const;

export interface WorkspaceStatus {
  key: string;
  label: string;
  color: string;
  order: number;
  builtIn: boolean;
}

/** Read a workspace's status list for one kind, falling back to the defaults. */
export async function getStatuses(workspaceId: string, kind: StatusKind): Promise<WorkspaceStatus[]> {
  const ws = await Workspace.findById(workspaceId).select(FIELD[kind]);
  const list = (ws?.get(FIELD[kind]) as WorkspaceStatus[] | undefined) ?? [];
  const resolved = list.length ? list : (DEFAULTS[kind] as unknown as WorkspaceStatus[]);
  return [...resolved].sort((a, b) => a.order - b.order);
}

export async function isValidStatus(
  workspaceId: string,
  kind: StatusKind,
  key: unknown,
): Promise<boolean> {
  if (typeof key !== 'string') return false;
  const list = await getStatuses(workspaceId, kind);
  return list.some((s) => s.key === key);
}

/** Turn a human label into a unique key not already taken in `existing`. */
export function makeStatusKey(label: string, existing: WorkspaceStatus[]): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'status';
  if (!existing.some((s) => s.key === base)) return base;
  let n = 2;
  while (existing.some((s) => s.key === `${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}
