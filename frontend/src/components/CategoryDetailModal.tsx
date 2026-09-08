import { useEffect, useMemo } from 'react';
import { X, ArrowLeft, FolderKanban, Users, ListChecks } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { StatusPill } from './TaskStatusPill';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Task, TaskPriority } from '@/utils/types';

const fmtDue = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'text-red-700 bg-red-50 border-red-200',
  high: 'text-orange-700 bg-orange-50 border-orange-200',
  normal: 'text-blue-700 bg-blue-50 border-blue-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

/**
 * A focused breakdown of one dashboard category (a status or priority slice).
 * Opened by clicking a pie slice; closes back to the dashboard.
 */
export default function CategoryDetailModal({
  title, tasks, totalTasks, onClose, onOpenTask, backLabel = 'Back to dashboard',
}: {
  title: string;
  tasks: Task[];
  totalTasks: number;
  onClose: () => void;
  onOpenTask: (id: string) => void;
  backLabel?: string;
}) {
  const { projects } = useTaskStore();
  const { members } = useWorkspaceStore();
  const statuses = useTaskStatuses();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const now = Date.now();

  const stats = useMemo(() => {
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const pending = tasks.filter((t) => t.status !== 'completed' && t.status !== 'in_progress').length;
    const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'completed').length;
    return { completed, inProgress, pending, overdue };
  }, [tasks, now]);

  const byProject = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const t of tasks) m.set(t.projectId, (m.get(t.projectId) ?? 0) + 1);
    return [...m.entries()]
      .map(([id, count]) => ({
        id,
        name: id ? (projects.find((p) => p.id === id)?.name ?? 'Unknown project') : 'No project',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [tasks, projects]);

  const byMember = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const t of tasks) m.set(t.assigneeId, (m.get(t.assigneeId) ?? 0) + 1);
    return [...m.entries()]
      .map(([id, count]) => ({
        id,
        name: id ? (members.find((x) => x.userId === id)?.user?.fullName ?? 'Unknown') : 'Unassigned',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [tasks, members]);

  const pct = totalTasks > 0 ? Math.round((tasks.length / totalTasks) * 100) : 0;

  const miniStats: { label: string; value: number; danger?: boolean }[] = [
    { label: 'Completed', value: stats.completed },
    { label: 'In progress', value: stats.inProgress },
    { label: 'Pending', value: stats.pending },
    { label: 'Overdue', value: stats.overdue, danger: stats.overdue > 0 },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[86vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary truncate">{title}</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              <b className="text-text-primary tabular-nums">{tasks.length}</b> task{tasks.length === 1 ? '' : 's'}
              {' · '}{pct}% of all tasks
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 -m-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-black/[0.04] transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Mini stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {miniStats.map((s) => (
              <div key={s.label} className="border border-border rounded-xl px-3 py-2.5">
                <p className={`text-lg font-bold tabular-nums leading-none ${s.danger ? 'text-accent-red' : 'text-text-primary'}`}>{s.value}</p>
                <p className="text-[11px] text-text-secondary mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Projects */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <FolderKanban size={13} className="text-text-secondary" />
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Related projects</h3>
            </div>
            {byProject.length === 0 ? (
              <p className="text-xs text-text-disabled">None</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {byProject.map((p) => (
                  <span key={p.id ?? 'none'} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-xs text-text-primary">
                    {p.name}
                    <span className="text-text-disabled tabular-nums">{p.count}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Members */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <Users size={13} className="text-text-secondary" />
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Assigned members</h3>
            </div>
            {byMember.length === 0 ? (
              <p className="text-xs text-text-disabled">None</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {byMember.map((mm) => (
                  <span key={mm.id ?? 'none'} className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                    <span className={`w-5 h-5 rounded-full ${mm.id ? colorFor(mm.id) : 'bg-text-disabled'} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                      {mm.id ? initialsOf(mm.name) : '—'}
                    </span>
                    <span className="text-xs text-text-primary">{mm.name}</span>
                    <span className="text-xs text-text-disabled tabular-nums">{mm.count}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Task list */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <ListChecks size={13} className="text-text-secondary" />
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Tasks</h3>
            </div>
            {tasks.length === 0 ? (
              <p className="text-xs text-text-disabled">No tasks.</p>
            ) : (
              <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                {tasks.map((t) => {
                  const assignee = members.find((m) => m.userId === t.assigneeId)?.user;
                  const project = projects.find((p) => p.id === t.projectId);
                  const overdueTask = t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'completed';
                  return (
                    <button
                      key={t.id}
                      onClick={() => { onOpenTask(t.id); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-black/[0.02] transition-colors"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-text-primary truncate">{t.name}</span>
                        {project && <span className="block text-[11px] text-text-secondary truncate">{project.name}</span>}
                      </span>
                      {t.dueDate && (
                        <span className={`text-[11px] shrink-0 tabular-nums ${overdueTask ? 'text-accent-red font-medium' : 'text-text-secondary'}`}>
                          {fmtDue(t.dueDate)}
                        </span>
                      )}
                      {assignee ? (
                        <span className={`w-6 h-6 rounded-full ${colorFor(t.assigneeId!)} flex items-center justify-center text-[9px] font-bold text-white shrink-0`} title={assignee.fullName}>
                          {initialsOf(assignee.fullName)}
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full border border-dashed border-border shrink-0" title="Unassigned" />
                      )}
                      <span className={`shrink-0 hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${priorityColors[t.priority]}`}>
                        {t.priority}
                      </span>
                      <span className="shrink-0"><StatusPill statuses={statuses} status={t.status} size="sm" /></span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} /> {backLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
