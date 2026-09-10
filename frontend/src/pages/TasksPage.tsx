import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ChevronDown, ChevronRight, Check, CheckSquare } from 'lucide-react';
import { useTaskStore, getVisibleTasks } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { useCan } from '@/utils/permissions';
import { describeTaskActivity } from '@/utils/activityText';
import TaskDetailInline from '@/components/TaskDetailInline';
import { taskProgress, type Task, type TaskActivityEntry } from '@/utils/types';

const COMPLETED = 'completed';

function fmtDue(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TaskRow({
  task, projectLabel, selected, canEdit, metaLine, lastActivityLine, onOpen, onToggle,
}: {
  task: Task;
  projectLabel: string | null;
  selected: boolean;
  canEdit: boolean;
  metaLine: string;
  lastActivityLine: string | null;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const done = task.status === COMPLETED;
  const overdue = task.dueDate ? new Date(task.dueDate) < new Date() && !done : false;

  return (
    <button
      onClick={onOpen}
      className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border text-left transition-colors ${
        selected ? 'bg-accent-purple/10' : 'hover:bg-black/[0.02]'
      }`}
    >
      <span
        role="checkbox"
        aria-checked={done}
        tabIndex={-1}
        onClick={(e) => { e.stopPropagation(); if (canEdit) onToggle(); }}
        className={`mt-0.5 w-[18px] h-[18px] rounded-full border flex items-center justify-center shrink-0 transition-colors ${
          done ? 'bg-accent-green border-accent-green text-white' : 'border-text-disabled hover:border-accent-purple'
        } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className={`text-sm truncate flex-1 min-w-0 ${done ? 'line-through text-text-disabled' : 'text-text-primary'}`}>
            {task.name}
          </span>
          {projectLabel && (
            <span className="hidden sm:inline text-[11px] text-text-secondary bg-black/[0.04] px-2 py-0.5 rounded-full shrink-0 max-w-[120px] truncate">
              {projectLabel}
            </span>
          )}
          <span className={`text-xs shrink-0 tabular-nums w-14 text-right ${overdue ? 'text-accent-red' : 'text-text-secondary'}`}>
            {fmtDue(task.dueDate)}
          </span>
          <ChevronRight size={15} className="text-text-disabled shrink-0" />
        </span>
        <span className="block text-[11px] text-text-secondary truncate mt-0.5">{metaLine}</span>
        {lastActivityLine && (
          <span className="block text-[11px] text-text-disabled truncate mt-0.5">{lastActivityLine}</span>
        )}
      </span>
    </button>
  );
}

function AddTaskButton() {
  const { setCreateModalOpen, setCreateModalTaskOnly, setCreateModalStatus } = useUiStore();
  const statuses = useTaskStatuses();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const create = (status?: string) => {
    setCreateModalTaskOnly(true);
    setCreateModalStatus(status ?? null);
    setCreateModalOpen(true);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex">
      <button
        onClick={() => create()}
        className="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 bg-accent-purple text-white text-sm font-medium rounded-l-lg hover:bg-purple-700 transition-colors"
      >
        <Plus size={15} /> Add Task
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More task options"
        className="px-1.5 bg-accent-purple text-white rounded-r-lg border-l border-white/20 hover:bg-purple-700 transition-colors"
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-surface border border-border rounded-xl shadow-xl z-20 py-1">
          <button onClick={() => create()} className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-black/[0.03] transition-colors">
            Blank task
          </button>
          <div className="my-1 border-t border-border" />
          <p className="px-3 py-1 text-[10px] font-semibold text-text-disabled uppercase tracking-wider">New task in</p>
          {statuses.map((s) => (
            <button
              key={s.key}
              onClick={() => create(s.key)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-black/[0.03] transition-colors"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 py-2 text-[11px] font-semibold text-text-secondary uppercase tracking-wider bg-black/[0.015] border-b border-border sticky top-0 z-10">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function TasksPage() {
  const store = useTaskStore();
  const { tasks, projects, updateTask } = store;
  const taskActivity = useTaskStore((s) => s.taskActivity);
  const taskActivityLoaded = useTaskStore((s) => s.taskActivityLoaded);
  const fetchTaskActivity = useTaskStore((s) => s.fetchTaskActivity);
  const { workspace, members } = useWorkspaceStore();
  const statuses = useTaskStatuses();
  const canEdit = useCan('manageTasks');
  const { setCreateModalOpen, setCreateModalTaskOnly } = useUiStore();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('task');

  const visible = getVisibleTasks(store);

  useEffect(() => {
    if (workspace && !taskActivityLoaded) void fetchTaskActivity(workspace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, taskActivityLoaded, fetchTaskActivity]);

  const setSelected = (id: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('task', id); else next.delete('task');
        return next;
      },
      { replace: true },
    );
  };

  // Drop the selection if the task disappears (deleted here or elsewhere).
  useEffect(() => {
    if (selectedId && tasks.length && !tasks.some((t) => t.id === selectedId)) {
      setSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, tasks]);

  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? map.get(id) ?? null : null);
  }, [projects]);

  const statusLabel = useMemo(() => {
    const map = new Map(statuses.map((s) => [s.key, s.label]));
    return (key: string) => map.get(key) ?? key;
  }, [statuses]);

  const memberName = useMemo(() => {
    const map = new Map(members.map((m) => [m.userId, m.user?.fullName ?? 'Someone']));
    return (id: string) => map.get(id) ?? 'Someone';
  }, [members]);

  // Most recent activity entry per task, for the list sub-line.
  const lastActivityByTask = useMemo(() => {
    const map = new Map<string, TaskActivityEntry>();
    for (const e of taskActivity) {
      if (!e.taskId) continue;
      const cur = map.get(e.taskId);
      if (!cur || e.createdAt > cur.createdAt) map.set(e.taskId, e);
    }
    return map;
  }, [taskActivity]);

  const { assigned, unassigned } = useMemo(() => {
    const byRecent = [...visible].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      assigned: byRecent.filter((t) => t.assigneeId),
      unassigned: byRecent.filter((t) => !t.assigneeId),
    };
  }, [visible]);

  const toggleDone = (task: Task) => {
    if (!workspace) return;
    void updateTask(workspace.id, task.id, { status: task.status === COMPLETED ? 'pending' : COMPLETED });
  };

  const renderRow = (task: Task) => {
    const prog = taskProgress(task);
    const metaParts = [
      task.assigneeId ? memberName(task.assigneeId) : 'Unassigned',
      statusLabel(task.status),
    ];
    if (prog) metaParts.push(`${prog.pct}%`);
    const la = lastActivityByTask.get(task.id);
    const lastActivityLine = la
      ? `${(la.actor?.fullName ?? 'Someone').split(' ')[0]} ${describeTaskActivity(la, statusLabel, (id) => projectName(id) ?? 'a project', memberName)} · ${timeAgo(la.createdAt)}`
      : null;

    return (
    <TaskRow
      key={task.id}
      task={task}
      projectLabel={projectName(task.projectId)}
      selected={task.id === selectedId}
      canEdit={canEdit}
      metaLine={metaParts.join(' · ')}
      lastActivityLine={lastActivityLine}
      onOpen={() => setSelected(task.id)}
      onToggle={() => toggleDone(task)}
    />
    );
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Left: task list */}
      <div
        className={`flex-col border-r border-border min-w-0 w-full lg:w-[58%] lg:flex ${
          selectedId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          {canEdit
            ? <AddTaskButton />
            : <span className="text-xs text-text-secondary">You have read-only access to tasks.</span>}
          <span className="ml-auto text-xs text-text-secondary tabular-nums">{visible.length} tasks</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
                <CheckSquare size={24} className="text-accent-purple" />
              </div>
              <p className="text-sm text-text-secondary">No tasks yet.</p>
              {canEdit && (
                <button
                  onClick={() => { setCreateModalTaskOnly(true); setCreateModalOpen(true); }}
                  className="px-4 py-2 bg-accent-purple text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  Add Task
                </button>
              )}
            </div>
          ) : (
            <>
              <Group title="Recently assigned">
                {assigned.length ? assigned.map(renderRow) : (
                  <p className="px-4 py-3 text-[12px] text-text-disabled">Nothing assigned yet.</p>
                )}
              </Group>
              {unassigned.length > 0 && <Group title="Unassigned">{unassigned.map(renderRow)}</Group>}
            </>
          )}
        </div>
      </div>

      {/* Right: task details */}
      <div className={`flex-1 min-w-0 lg:flex ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
        {selectedId ? (
          <TaskDetailInline taskId={selectedId} onBack={() => setSelected(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-black/[0.03] flex items-center justify-center">
              <CheckSquare size={22} className="text-text-disabled" />
            </div>
            <p className="text-sm text-text-secondary">Select a task to see its details</p>
          </div>
        )}
      </div>
    </div>
  );
}
