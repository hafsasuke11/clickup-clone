import { useEffect, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useTaskStore, getVisibleTasks } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { FilterButton, AssigneeButton } from '@/components/TaskToolbar';
import { DonutChart, RadialGauge, StackedBar, MiniBars, type Slice, type DayBar } from '@/components/StatCharts';
import CategoryDetailModal from '@/components/CategoryDetailModal';
import TaskContextMenu from '@/components/TaskContextMenu';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Task, TaskPriority } from '@/utils/types';

const PRIORITIES: { key: TaskPriority; label: string }[] = [
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'normal', label: 'Normal' },
  { key: 'low', label: 'Low' },
];

const localKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function Kpi({ label, value, hint, danger }: { label: string; value: number; hint?: string; danger?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">{label}</p>
      <p className={`mt-1.5 text-[26px] font-bold leading-none tabular-nums ${danger ? 'text-accent-red' : 'text-text-primary'}`}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-text-secondary">{hint}</p>}
    </div>
  );
}

function Card({ title, right, children, bodyClassName = 'p-4' }: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="bg-surface border border-border rounded-xl flex flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {right}
      </header>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const emptyRow = (text: string) => (
  <p className="text-sm text-text-secondary px-4 py-10 text-center">{text}</p>
);

export default function DashboardPage() {
  const store = useTaskStore();
  const { projects, taskActivity, fetchTaskActivity } = store;
  const tasks = getVisibleTasks(store);
  const { workspace, members } = useWorkspaceStore();
  const statuses = useTaskStatuses();
  const { setSelectedTaskId } = useUiStore();

  const [detail, setDetail] = useState<{ title: string; tasks: Task[] } | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuTask = menu ? tasks.find((t) => t.id === menu.id) ?? null : null;

  useEffect(() => {
    if (menu && !menuTask) setMenu(null);
  }, [menu, menuTask]);

  // Long-press (mobile) / right-click (desktop) on an Upcoming row → task menu.
  const hold = useRef<{ timer: number | null; start: { x: number; y: number } | null; last: { x: number; y: number }; armed: boolean; fired: boolean }>({
    timer: null, start: null, last: { x: 0, y: 0 }, armed: false, fired: false,
  });
  const endHold = () => {
    if (hold.current.timer) window.clearTimeout(hold.current.timer);
    hold.current.timer = null;
    hold.current.start = null;
  };
  const downHold = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const pt = { x: e.clientX, y: e.clientY };
    hold.current = {
      timer: window.setTimeout(() => {
        hold.current.armed = true;
        if (navigator.vibrate) navigator.vibrate(8);
      }, 450),
      start: pt, last: pt, armed: false, fired: false,
    };
  };
  const moveHold = (e: React.PointerEvent) => {
    const h = hold.current;
    h.last = { x: e.clientX, y: e.clientY };
    if (h.start && !h.armed && (Math.abs(e.clientX - h.start.x) > 10 || Math.abs(e.clientY - h.start.y) > 10)) endHold();
  };
  const upHold = (id: string) => {
    const h = hold.current;
    endHold();
    if (h.armed) { h.armed = false; h.fired = true; setMenu({ id, x: h.last.x, y: h.last.y }); }
  };
  const clickRow = (id: string) => {
    if (hold.current.fired) { hold.current.fired = false; return; }
    setSelectedTaskId(id);
  };

  useEffect(() => {
    if (workspace) void fetchTaskActivity(workspace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const now = Date.now();

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const pending = tasks.filter((t) => t.status !== 'completed' && t.status !== 'in_progress').length;
  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'completed');
  const completionPct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  // ── Composition ───────────────────────────────────────────────────────────
  const statusSlices: Slice[] = statuses
    .map((s) => ({ label: s.label, value: tasks.filter((t) => t.status === s.key).length, key: s.key }))
    .filter((s) => s.value > 0);

  const prioritySlices: Slice[] = PRIORITIES
    .map((p) => ({ label: p.label, value: tasks.filter((t) => t.priority === p.key).length, key: p.key }))
    .filter((p) => p.value > 0);

  // ── This week ─────────────────────────────────────────────────────────────
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const buckets = new Map(days.map((d) => [localKey(d), { created: 0, completed: 0 }]));
  for (const e of taskActivity) {
    const b = buckets.get(localKey(new Date(e.createdAt)));
    if (!b) continue;
    if (e.action === 'task_created') b.created += 1;
    else if (e.action === 'task_completed') b.completed += 1;
  }
  const trend: DayBar[] = days.map((d) => ({
    label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
    ...buckets.get(localKey(d))!,
  }));
  const weekCreated = trend.reduce((s, d) => s + d.created, 0);
  const weekCompleted = trend.reduce((s, d) => s + d.completed, 0);

  // ── Lists ─────────────────────────────────────────────────────────────────
  const upcoming = tasks
    .filter((t) => t.dueDate && t.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 8);

  // ── Workload ──────────────────────────────────────────────────────────────
  const workload = members
    .map((m) => {
      const mine = tasks.filter((t) => t.assigneeId === m.userId);
      return {
        member: m,
        active: mine.filter((t) => t.status !== 'completed').length,
        done: mine.filter((t) => t.status === 'completed').length,
        overdue: mine.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'completed').length,
      };
    })
    .sort((a, b) => b.active - a.active);
  const maxActive = Math.max(1, ...workload.map((w) => w.active));
  const openTotal = workload.reduce((s, w) => s + w.active, 0);

  const openStatusDetail = (slice: Slice) =>
    setDetail({ title: `${slice.label} tasks`, tasks: tasks.filter((t) => t.status === slice.key) });
  const openPriorityDetail = (slice: Slice) =>
    setDetail({ title: `${slice.label} priority tasks`, tasks: tasks.filter((t) => t.priority === slice.key) });

  // Clicking a Created / Completed count in "This week" opens the same detail
  // modal as the other charts, listing that day's tasks for that action.
  const openDayDetail = (_day: DayBar, kind: 'created' | 'completed', i: number) => {
    const dayDate = days[i];
    const key = localKey(dayDate);
    const action = kind === 'created' ? 'task_created' : 'task_completed';
    const ids = new Set(
      taskActivity
        .filter((e) => e.action === action && e.taskId && localKey(new Date(e.createdAt)) === key)
        .map((e) => e.taskId as string),
    );
    const when = dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    setDetail({
      title: `${kind === 'created' ? 'Created' : 'Completed'} · ${when}`,
      tasks: tasks.filter((t) => ids.has(t.id)),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <FilterButton />
          <AssigneeButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-6 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Total tasks" value={tasks.length} hint={`across ${projects.length} project${projects.length === 1 ? '' : 's'}`} />
            <Kpi label="Completed" value={completed} hint={`${completionPct}% of all tasks`} />
            <Kpi label="In progress" value={inProgress} hint={`${pending} not started`} />
            <Kpi label="Overdue" value={overdue.length} danger={overdue.length > 0} hint={overdue.length > 0 ? 'needs attention' : 'all on track'} />
          </div>

          {/* Analytics */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Tasks by status">
              {statusSlices.length === 0 ? emptyRow('No tasks yet.') : (
                <DonutChart data={statusSlices} centerLabel="tasks" onSelect={openStatusDetail} hint="Click a category for the full breakdown" />
              )}
            </Card>

            <Card title="Completion">
              <div className="flex flex-col items-center gap-4 py-1">
                <RadialGauge value={completed} max={tasks.length} label="of all tasks" />
                <div className="grid grid-cols-3 gap-2 w-full">
                  {[
                    { label: 'Active', value: tasks.length - completed },
                    { label: 'Done', value: completed },
                    { label: 'Overdue', value: overdue.length, danger: overdue.length > 0 },
                  ].map((s) => (
                    <div key={s.label} className="border border-border rounded-lg px-2 py-2 text-center">
                      <p className={`text-base font-bold tabular-nums leading-none ${s.danger ? 'text-accent-red' : 'text-text-primary'}`}>{s.value}</p>
                      <p className="text-[10px] text-text-secondary mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="By priority">
              {prioritySlices.length === 0 ? emptyRow('No tasks yet.') : (
                <div className="pt-1">
                  <StackedBar data={prioritySlices} onSelect={openPriorityDetail} />
                </div>
              )}
            </Card>
          </div>

          {/* This week */}
          <Card
            title="This week"
            right={
              <span className="text-[11px] text-text-secondary tabular-nums">
                {weekCreated} created · {weekCompleted} completed
              </span>
            }
          >
            <MiniBars data={trend} onSelect={openDayDetail} />
            <div className="flex items-center gap-4 mt-3 text-[10px] text-text-secondary">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#C2B5F3' }} /> Created</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#6D4FE0' }} /> Completed</span>
            </div>
          </Card>

          {/* Upcoming due dates */}
          <Card
            title="Upcoming due dates"
            right={<CalendarClock size={14} className="text-text-disabled" />}
            bodyClassName="divide-y divide-border max-h-[360px] overflow-y-auto"
          >
            {upcoming.length === 0
              ? emptyRow('Nothing due soon.')
              : upcoming.map((t) => {
                  const od = new Date(t.dueDate!).getTime() < now;
                  const proj = projects.find((p) => p.id === t.projectId);
                  return (
                    <button
                      key={t.id}
                      onPointerDown={downHold}
                      onPointerMove={moveHold}
                      onPointerUp={() => upHold(t.id)}
                      onPointerCancel={endHold}
                      onClick={() => clickRow(t.id)}
                      onContextMenu={(e) => { e.preventDefault(); setMenu({ id: t.id, x: e.clientX, y: e.clientY }); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors select-none"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-text-primary truncate">{t.name}</span>
                        {proj && <span className="block text-[11px] text-text-secondary truncate">{proj.name}</span>}
                      </span>
                      <span className={`text-xs shrink-0 tabular-nums ${od ? 'text-accent-red font-medium' : 'text-text-secondary'}`}>
                        {od ? 'Overdue · ' : ''}
                        {new Date(t.dueDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </button>
                  );
                })}
          </Card>

          {/* Workload */}
          <Card
            title="Team workload"
            right={<span className="text-[11px] text-text-secondary tabular-nums">{openTotal} open task{openTotal === 1 ? '' : 's'}</span>}
          >
            {workload.length === 0 ? (
              <p className="text-sm text-text-secondary py-6 text-center">No members yet.</p>
            ) : (
              <div className="space-y-3">
                {workload.map(({ member, active, done, overdue: od }) => (
                  <div key={member.userId} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full ${colorFor(member.userId)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                      {member.user ? initialsOf(member.user.fullName) : '?'}
                    </span>
                    <span className="text-xs text-text-primary w-32 truncate shrink-0">{member.user?.fullName ?? 'Unknown'}</span>
                    <div className="flex-1 h-2 rounded-full bg-black/[0.04] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(active / maxActive) * 100}%`, background: '#6D4FE0' }} />
                    </div>
                    <span className="text-xs font-semibold text-text-primary tabular-nums w-6 text-right shrink-0">{active}</span>
                    <span className="text-[11px] tabular-nums shrink-0 w-28 text-right">
                      <span className="text-text-disabled">{done} done</span>
                      {od > 0 && <span className="text-accent-red"> · {od} overdue</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {detail && (
        <CategoryDetailModal
          title={detail.title}
          tasks={detail.tasks}
          totalTasks={tasks.length}
          onClose={() => setDetail(null)}
          onOpenTask={setSelectedTaskId}
        />
      )}

      {menu && menuTask && (
        <TaskContextMenu
          task={menuTask}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onView={() => setSelectedTaskId(menu.id)}
          onEdit={() => setSelectedTaskId(menu.id)}
        />
      )}
    </div>
  );
}
