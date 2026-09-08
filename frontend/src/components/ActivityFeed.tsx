import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { describeTaskActivity } from '@/utils/activityText';
import { pageList } from '@/utils/pagination';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import ConfirmDialog from './ConfirmDialog';
import type { TaskActivityEntry } from '@/utils/types';

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

/** from → to labels for the actions that carry a transition. */
function changePair(e: TaskActivityEntry, statusLabel: (k: string) => string): { from: string; to: string } | null {
  const m = e.meta ?? {};
  if ((e.action === 'task_status_changed' || e.action === 'task_reopened') && m.to != null) {
    return { from: m.from != null ? statusLabel(String(m.from)) : 'New', to: statusLabel(String(m.to)) };
  }
  if (e.action === 'task_completed') {
    return { from: m.from != null ? statusLabel(String(m.from)) : 'Open', to: statusLabel('completed') };
  }
  if (e.action === 'task_priority_changed' && (m.from != null || m.to != null)) {
    const cap = (v: unknown) => String(v ?? '—').replace(/\b\w/, (c) => c.toUpperCase());
    return { from: cap(m.from), to: cap(m.to) };
  }
  return null;
}

export interface ActivityFeedProps {
  entries: TaskActivityEntry[];
  workspaceId: string;
  /** The signed-in user; their own rows show as "You …". */
  selfActorId?: string;
  paginated?: boolean;
  pageSize?: number;
  /** A left-click on a row whose task still exists opens it. */
  onOpenTask?: (taskId: string) => void;
  liveTaskIds?: Set<string>;
  statusLabel: (k: string) => string;
  projectName: (id: string | null) => string;
  memberName: (id: string) => string;
  emptyText?: string;
}

/**
 * A read-only activity list. A left-click on a row opens its task; deleting an
 * entry is done through the right-click menu only (with a confirmation) and
 * never opens the task, navigates, or enters any selection mode.
 */
export default function ActivityFeed({
  entries,
  workspaceId,
  selfActorId,
  paginated = true,
  pageSize = 10,
  onOpenTask,
  liveTaskIds,
  statusLabel,
  projectName,
  memberName,
  emptyText = 'Nothing to show.',
}: ActivityFeedProps) {
  const deleteEntries = useTaskStore((s) => s.deleteTaskActivityEntries);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries],
  );

  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ entry: TaskActivityEntry; x: number; y: number } | null>(null);
  const [confirmEntry, setConfirmEntry] = useState<TaskActivityEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);
  const visible = paginated ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize) : sorted;

  // Pagination self-corrects as rows are deleted.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

  const canOpen = (e: TaskActivityEntry) =>
    !!onOpenTask && e.taskId != null && (!liveTaskIds || liveTaskIds.has(e.taskId));

  const runDelete = async (e: TaskActivityEntry) => {
    setDeleting(true);
    try {
      await deleteEntries(workspaceId, [e.id]);
    } finally {
      setDeleting(false);
      setConfirmEntry(null);
    }
  };

  if (sorted.length === 0) {
    return <p className="text-sm text-text-secondary px-4 py-8 text-center">{emptyText}</p>;
  }

  return (
    <div>
      {paginated && (
        <div className="px-4 py-2 border-b border-border">
          <span className="text-[11px] text-text-secondary tabular-nums">
            {rangeStart}–{rangeEnd} of {total}
          </span>
        </div>
      )}

      <ul className="divide-y divide-border">
        {visible.map((e) => {
          const mine = selfActorId != null && e.actor?.id === selfActorId;
          const pair = changePair(e, statusLabel);
          const openable = canOpen(e);
          return (
            <li
              key={e.id}
              onClick={() => { if (openable) onOpenTask!(e.taskId!); }}
              onContextMenu={(ev) => { ev.preventDefault(); setMenu({ entry: e, x: ev.clientX, y: ev.clientY }); }}
              className={`group flex items-start gap-2.5 px-4 py-3 transition-colors ${
                openable ? 'cursor-pointer hover:bg-black/[0.015]' : ''
              }`}
            >
              <span className={`w-6 h-6 mt-0.5 rounded-full ${colorFor(e.actor?.id ?? 'x')} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                {e.actor ? initialsOf(e.actor.fullName) : '?'}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-text-primary leading-snug">
                  <span className="font-medium">{mine ? 'You' : (e.actor?.fullName ?? 'Someone')}</span>{' '}
                  <span className="text-text-secondary">{describeTaskActivity(e, statusLabel, projectName, memberName)}</span>{' '}
                  <span className="font-medium">“{e.taskName}”</span>
                </p>
                {pair && (
                  <span className="inline-flex items-center gap-1.5 mt-1 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-black/[0.05] text-text-secondary">{pair.from}</span>
                    <span className="text-text-disabled">→</span>
                    <span className="px-1.5 py-0.5 rounded bg-accent-purple/10 text-accent-purple font-medium">{pair.to}</span>
                  </span>
                )}
                <p className="text-[10px] text-text-disabled mt-1">{projectName(e.projectId)}</p>
              </div>

              <span className="text-[11px] text-text-disabled shrink-0 tabular-nums mt-0.5">{timeAgo(e.createdAt)}</span>
            </li>
          );
        })}
      </ul>

      {paginated && totalPages > 1 && (
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

      {/* Right-click menu — the only way to delete an activity. */}
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
              left: Math.max(8, Math.min(menu.x, window.innerWidth - 184)),
              top: Math.max(8, Math.min(menu.y, window.innerHeight - 80)),
            }}
            className="fixed z-[61] w-44 bg-surface border border-border rounded-xl shadow-2xl py-1 overflow-hidden animate-slide-up"
          >
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-accent-red hover:bg-accent-red/10 transition-colors"
              onClick={() => { setConfirmEntry(menu.entry); setMenu(null); }}
            >
              <Trash2 size={15} className="shrink-0" /> Delete Activity
            </button>
          </div>
        </>
      )}

      {confirmEntry && (
        <ConfirmDialog
          title="Delete this activity?"
          message="This removes the activity record only. The task it describes is not affected."
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
