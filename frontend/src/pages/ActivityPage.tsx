import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CalendarRange, X, Trash2, ArrowUpRight } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useCan, useIsOwner } from '@/utils/permissions';
import {
  activityBucket, describeActivity, describeTaskActivity, type ActivityBucket,
} from '@/utils/activityText';
import { pageList } from '@/utils/pagination';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { OverallActivityEntry, TaskActivityEntry } from '@/utils/types';

const PAGE_SIZE = 10;

type Category = 'all' | 'tasks' | 'projects' | 'statuses' | 'members' | 'workspace';

const CATEGORY_LABELS: Record<Exclude<Category, 'all'>, string> = {
  tasks: 'Tasks',
  projects: 'Projects',
  statuses: 'Statuses',
  members: 'Members & permissions',
  workspace: 'Workspace',
};

const BUCKETS: { key: ActivityBucket; label: string; cls: string }[] = [
  { key: 'added', label: 'Added', cls: 'text-accent-blue' },
  { key: 'updated', label: 'Updated', cls: 'text-accent-purple' },
  { key: 'completed', label: 'Completed', cls: 'text-accent-green' },
  { key: 'deleted', label: 'Deleted', cls: 'text-accent-red' },
];

const selectCls =
  'bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-purple transition-colors max-w-[10rem]';
const dateCls =
  'bg-background border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-purple transition-colors';
const menuItemCls =
  'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-text-primary hover:bg-black/[0.04] transition-colors';

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Which category filter an entry belongs to. */
function categoryOf(e: OverallActivityEntry): Exclude<Category, 'all'> {
  if (e.source === 'task') return 'tasks';
  if (e.action.startsWith('project_')) return 'projects';
  if (e.action.startsWith('status_')) return 'statuses';
  if (e.action === 'workspace_renamed') return 'workspace';
  return 'members';
}

/** The project an entry is associated with, if any. */
function projectIdOf(e: OverallActivityEntry): string | null {
  if (e.source === 'task') return e.projectId ?? null;
  return typeof e.meta.projectId === 'string' ? e.meta.projectId : null;
}

export default function ActivityPage() {
  const navigate = useNavigate();
  const { workspace, members } = useWorkspaceStore();
  const {
    tasks, projects, overallActivity, overallActivityLoaded,
    fetchOverallActivity, fetchTasks, fetchProjects, deleteOverallActivityEntries,
  } = useTaskStore();
  const setHighlightTaskId = useUiStore((s) => s.setHighlightTaskId);
  const selfActorId = useAuthStore((s) => s.user?.id);
  const taskStatuses = useTaskStatuses();
  const isOwner = useIsOwner();
  const canManageTaskActivity = useCan('manageProjects');
  const canManageMemberActivity = useCan('manageMembers');

  const [userFilter, setUserFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [taskFilter, setTaskFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<Category>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ActivityBucket>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ entry: OverallActivityEntry; x: number; y: number } | null>(null);
  const [confirmEntry, setConfirmEntry] = useState<OverallActivityEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Close the row menu on Escape or when the page scrolls under it.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  useEffect(() => {
    if (workspace) void fetchOverallActivity(workspace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const liveTaskIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);

  const openTaskOnBoard = (taskId: string) => {
    setHighlightTaskId(taskId);
    navigate('/app/board');
  };

  // A member may delete their own rows; managing tasks/projects covers task
  // activity, managing members (or owner) covers audit rows.
  const canDeleteEntry = (e: OverallActivityEntry) => {
    if (e.actor?.id && e.actor.id === selfActorId) return true;
    return e.source === 'task' ? canManageTaskActivity : (isOwner || canManageMemberActivity);
  };

  const runDelete = async (e: OverallActivityEntry) => {
    if (!workspace) return;
    setDeleting(true);
    try {
      await deleteOverallActivityEntries(workspace.id, [{ id: e.id, source: e.source }]);
    } finally {
      setDeleting(false);
      setConfirmEntry(null);
    }
  };

  const statusLabel = (k: string) => taskStatuses.find((s) => s.key === k)?.label ?? k;
  const projectName = (id: string | null) =>
    id ? (projects.find((p) => p.id === id)?.name ?? 'a project') : 'No project';
  const memberName = (id: string) => members.find((m) => m.userId === id)?.user?.fullName ?? 'Someone';

  const taskOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of overallActivity) if (e.source === 'task' && e.taskId) m.set(e.taskId, e.taskName ?? 'Untitled');
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [overallActivity]);

  // The project filter also scopes the "By member" summary.
  const byProject = useMemo(
    () =>
      overallActivity.filter((e) => {
        if (projectFilter === 'all') return true;
        if (projectFilter === 'none') return projectIdOf(e) === null;
        return projectIdOf(e) === projectFilter;
      }),
    [overallActivity, projectFilter],
  );

  const summary = useMemo(() => {
    return members
      .map((m) => {
        const mine = byProject.filter((e) => e.actor?.id === m.userId);
        const counts: Record<ActivityBucket, number> = { added: 0, updated: 0, completed: 0, deleted: 0 };
        mine.forEach((e) => { counts[activityBucket(e.action)] += 1; });
        return { member: m, counts, total: mine.length };
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [members, byProject]);

  const filtersActive =
    userFilter !== 'all' ||
    projectFilter !== 'all' ||
    taskFilter !== 'all' ||
    categoryFilter !== 'all' ||
    typeFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '';

  const clearFilters = () => {
    setUserFilter('all');
    setProjectFilter('all');
    setTaskFilter('all');
    setCategoryFilter('all');
    setTypeFilter('all');
    setFromDate('');
    setToDate('');
  };

  const filtered = useMemo(() => {
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return overallActivity.filter((e) => {
      if (userFilter !== 'all' && e.actor?.id !== userFilter) return false;
      if (categoryFilter !== 'all' && categoryOf(e) !== categoryFilter) return false;
      if (projectFilter === 'none') {
        if (projectIdOf(e) !== null) return false;
      } else if (projectFilter !== 'all' && projectIdOf(e) !== projectFilter) {
        return false;
      }
      if (taskFilter !== 'all' && (e.source !== 'task' || e.taskId !== taskFilter)) return false;
      if (typeFilter !== 'all' && activityBucket(e.action) !== typeFilter) return false;
      const t = new Date(e.createdAt).getTime();
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;
      return true;
    });
  }, [overallActivity, userFilter, categoryFilter, projectFilter, taskFilter, typeFilter, fromDate, toDate]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, total);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filterKey = [userFilter, projectFilter, taskFilter, categoryFilter, typeFilter, fromDate, toDate].join('|');
  useEffect(() => { setPage(1); }, [filterKey]);

  const refresh = async () => {
    if (!workspace || refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchOverallActivity(workspace.id),
        fetchTasks(workspace.id),
        fetchProjects(workspace.id),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className={selectCls} title="User">
          <option value="all">All users</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.user?.fullName ?? 'Unknown'}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as Category)}
          className={selectCls}
          title="Category"
        >
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as Exclude<Category, 'all'>[]).map((k) => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>

        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={selectCls} title="Project">
          <option value="all">All projects</option>
          <option value="none">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} className={selectCls} title="Task">
          <option value="all">All tasks</option>
          {taskOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | ActivityBucket)}
          className={selectCls}
          title="Activity type"
        >
          <option value="all">All activity types</option>
          {BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>

        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <CalendarRange size={13} className="shrink-0" />
          <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className={dateCls} title="From date" />
          <span className="text-text-disabled">→</span>
          <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className={dateCls} title="To date" />
        </div>

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-background text-xs text-text-secondary hover:text-accent-red hover:border-accent-red/40 transition-colors"
          >
            <X size={12} /> Clear filters
          </button>
        )}

        <button
          onClick={() => void refresh()}
          className="ml-auto p-1.5 rounded-lg border border-border bg-background text-text-secondary hover:text-text-primary transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {!overallActivityLoaded ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="w-full space-y-6">
            {/* By member */}
            <section>
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">By member</h2>
              {summary.length === 0 ? (
                <p className="text-sm text-text-secondary bg-surface border border-border rounded-xl px-4 py-6 text-center">
                  No activity yet{projectFilter !== 'all' ? ' for this project' : ''}.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.map(({ member, counts, total: memberTotal }) => (
                    <div key={member.userId} className="bg-surface border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={`w-8 h-8 rounded-full ${colorFor(member.userId)} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}>
                          {member.user ? initialsOf(member.user.fullName) : '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{member.user?.fullName ?? 'Unknown'}</p>
                          <p className="text-[11px] text-text-secondary tabular-nums">{memberTotal} action{memberTotal === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center">
                        {BUCKETS.map((b) => (
                          <div key={b.key}>
                            <p className={`text-base font-semibold tabular-nums ${counts[b.key] ? b.cls : 'text-text-disabled'}`}>{counts[b.key]}</p>
                            <p className="text-[10px] text-text-secondary">{b.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* All activity — the whole-workspace timeline, newest first, paginated.
                Click a quoted task name to open it on the Board. */}
            <section>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">All activity</h2>
                {total > 0 && (
                  <span className="text-[11px] text-text-disabled tabular-nums">
                    {rangeStart}–{rangeEnd} of {total}
                  </span>
                )}
              </div>

              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                {total === 0 ? (
                  <p className="text-sm text-text-secondary px-4 py-6 text-center">
                    Nothing to show{filtersActive ? ' for these filters' : ''}.
                  </p>
                ) : (
                  <>
                    <ul className="divide-y divide-border">
                      {visible.map((e) => {
                        const mine = selfActorId != null && e.actor?.id === selfActorId;
                        const isTask = e.source === 'task';
                        const taskLive = isTask && !!e.taskId && liveTaskIds.has(e.taskId);
                        const desc = isTask
                          ? describeTaskActivity(e as unknown as TaskActivityEntry, statusLabel, projectName, memberName)
                          : describeActivity(e);
                        const secondary = isTask
                          ? projectName(e.projectId ?? null)
                          : CATEGORY_LABELS[categoryOf(e)];
                        return (
                          <li
                            key={`${e.source}-${e.id}`}
                            onContextMenu={(ev) => { ev.preventDefault(); setMenu({ entry: e, x: ev.clientX, y: ev.clientY }); }}
                            className="flex items-start gap-2.5 px-4 py-3 hover:bg-black/[0.015] transition-colors"
                          >
                            <span className={`w-6 h-6 mt-0.5 rounded-full ${colorFor(e.actor?.id ?? 'x')} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                              {e.actor ? initialsOf(e.actor.fullName) : '?'}
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] text-text-primary leading-snug">
                                <span className="font-medium">{mine ? 'You' : (e.actor?.fullName ?? 'Someone')}</span>{' '}
                                <span className="text-text-secondary">{desc}</span>
                                {isTask && e.taskName && (
                                  <>
                                    {' '}
                                    {taskLive ? (
                                      <button
                                        type="button"
                                        onClick={() => openTaskOnBoard(e.taskId!)}
                                        title="Open this task on the board"
                                        className="text-[13px] font-medium text-accent-purple hover:underline align-baseline"
                                      >
                                        “{e.taskName}”
                                      </button>
                                    ) : (
                                      <span className="font-medium">“{e.taskName}”</span>
                                    )}
                                  </>
                                )}
                              </p>
                              <p className="text-[10px] text-text-disabled mt-1">{secondary}</p>
                            </div>

                            <span className="text-[11px] text-text-disabled shrink-0 tabular-nums mt-0.5">{timeAgo(e.createdAt)}</span>
                          </li>
                        );
                      })}
                    </ul>

                    {totalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-center gap-1 px-4 py-2.5 border-t border-border">
                        <button
                          onClick={() => setPage(safePage - 1)}
                          disabled={safePage === 1}
                          className="min-w-[70px] px-2.5 py-1 rounded-md border border-border bg-surface text-xs text-text-secondary hover:text-text-primary hover:border-accent-purple/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                          Previous
                        </button>
                        {pageList(safePage, totalPages).map((p, i) =>
                          p === 'gap' ? (
                            <span key={`gap-${i}`} className="px-1.5 text-text-disabled text-xs">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setPage(p)}
                              className={`min-w-[28px] px-2 py-1 rounded-md border text-xs transition-colors ${
                                p === safePage
                                  ? 'border-accent-purple bg-accent-purple text-white font-medium'
                                  : 'border-border bg-surface text-text-secondary hover:text-text-primary hover:border-accent-purple/40'
                              }`}
                            >
                              {p}
                            </button>
                          ),
                        )}
                        <button
                          onClick={() => setPage(safePage + 1)}
                          disabled={safePage === totalPages}
                          className="min-w-[56px] px-2.5 py-1 rounded-md border border-border bg-surface text-xs text-text-secondary hover:text-text-primary hover:border-accent-purple/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Right-click row menu */}
      {menu && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
          />
          <div
            role="menu"
            style={{
              left: Math.max(8, Math.min(menu.x, window.innerWidth - 208)),
              top: Math.max(8, Math.min(menu.y, window.innerHeight - 140)),
            }}
            className="fixed z-[61] w-52 bg-surface border border-border rounded-xl shadow-2xl py-1 overflow-hidden animate-slide-up"
          >
            <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-text-disabled truncate">
              {menu.entry.source === 'task' ? (menu.entry.taskName || 'Task activity') : CATEGORY_LABELS[categoryOf(menu.entry)]}
            </p>
            <div className="mb-1 border-t border-border" />

            {menu.entry.source === 'task' && menu.entry.taskId && liveTaskIds.has(menu.entry.taskId) && (
              <button
                className={menuItemCls}
                onClick={() => { openTaskOnBoard(menu.entry.taskId!); setMenu(null); }}
              >
                <ArrowUpRight size={15} className="shrink-0 text-text-secondary" /> Open on Board
              </button>
            )}

            {canDeleteEntry(menu.entry) ? (
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-accent-red hover:bg-accent-red/10 transition-colors"
                onClick={() => { setConfirmEntry(menu.entry); setMenu(null); }}
              >
                <Trash2 size={15} className="shrink-0" /> Delete activity
              </button>
            ) : (
              <p className="px-3 py-2 text-xs text-text-disabled">You can only remove your own activity.</p>
            )}
          </div>
        </>
      )}

      {confirmEntry && (
        <ConfirmDialog
          title="Delete activity entry?"
          message="This removes the activity record only. The task, project, status or change it describes is not affected."
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={() => void runDelete(confirmEntry)}
          onCancel={() => setConfirmEntry(null)}
        />
      )}
    </div>
  );
}
