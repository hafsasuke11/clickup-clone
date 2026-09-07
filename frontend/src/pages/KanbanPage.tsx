import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { Plus, Calendar, LayoutDashboard, CalendarRange, X } from 'lucide-react';
import { useTaskStore, getVisibleTasks } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { FilterButton, AssigneeButton, SortButton } from '@/components/TaskToolbar';
import { StatusPill, StatusDot } from '@/components/TaskStatusPill';
import { StatusColumnMenu, AddStatusButton } from '@/components/StatusManager';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Task, TaskPriority, WorkspaceStatus } from '@/utils/types';

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'text-red-700 bg-red-50 border-red-200',
  high: 'text-orange-700 bg-orange-50 border-orange-200',
  normal: 'text-blue-700 bg-blue-50 border-blue-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dayOf = (iso: string) => iso.split('T')[0];

function DraggableCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const { members } = useWorkspaceStore();
  const assignee = members.find((m) => m.userId === task.assigneeId)?.user;
  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
  const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== 'completed' : false;
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onClick}
      style={{ opacity: isDragging ? 0 : 1 }}
      className="bg-surface border border-border rounded-xl p-3 cursor-pointer hover:border-accent-purple/40 hover:shadow-sm transition-all select-none space-y-2">
      <p className="text-sm text-text-primary leading-snug break-words">{task.name}</p>
      <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
        <span className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${priorityColors[task.priority]}`}>{task.priority}</span>
        <div className="flex items-center gap-1.5">
          {due && (
            <span className={`flex items-center gap-1 text-[11px] ${isOverdue ? 'text-accent-red' : 'text-text-secondary'}`}>
              <Calendar size={11} /> {due}
            </span>
          )}
          {assignee && (
            <div className={`w-5 h-5 rounded-full ${colorFor(task.assigneeId!)} flex items-center justify-center text-[9px] font-bold text-white`}>{initialsOf(assignee.fullName)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({ status, statuses, tasks }: { status: WorkspaceStatus; statuses: WorkspaceStatus[]; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.key });
  const { setSelectedTaskId } = useUiStore();
  return (
    <div
      ref={setNodeRef}
      className="min-w-0 flex flex-col rounded-2xl transition-all p-1.5"
      style={isOver ? { backgroundColor: `${status.color}14`, boxShadow: `inset 0 0 0 1px ${status.color}55` } : undefined}
    >
      <div className="h-[3px] rounded-full mb-3 opacity-80" style={{ backgroundColor: status.color }} />
      <div className="flex items-center gap-1.5 mb-3 px-1 min-w-0">
        <div className="min-w-0 overflow-hidden flex">
          <StatusPill statuses={statuses} status={status.key} size="sm" />
        </div>
        <span className="text-xs text-text-secondary bg-black/[0.04] rounded-full px-1.5 py-0.5 tabular-nums shrink-0">{tasks.length}</span>
        <div className="ml-auto shrink-0">
          <StatusColumnMenu kind="task" statusKey={status.key} />
        </div>
      </div>
      <div className="space-y-2 flex-1 min-h-[40px]">
        {tasks.map((t) => <DraggableCard key={t.id} task={t} onClick={() => setSelectedTaskId(t.id)} />)}
      </div>
    </div>
  );
}

function EmptyState() {
  const { setCreateModalOpen } = useUiStore();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
      <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
        <LayoutDashboard size={28} className="text-accent-purple" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary">Your board is empty</h2>
      <p className="text-sm text-text-secondary">Create your first task to get started.</p>
      <button onClick={() => setCreateModalOpen(true)} className="px-4 py-2 bg-accent-purple text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
        Add Task
      </button>
    </div>
  );
}

export default function KanbanPage() {
  const store = useTaskStore();
  const { tasks, updateTask } = store;
  const { workspace } = useWorkspaceStore();
  const statuses = useTaskStatuses();
  const { setCreateModalOpen } = useUiStore();
  const visibleTasks = getVisibleTasks(store);
  const [dragging, setDragging] = useState<Task | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const rangeActive = Boolean(from && to && from <= to);
  const now = Date.now();

  // When a Workload range is set, the board only shows tasks whose due date
  // falls inside that period (tasks with no due date are hidden).
  const boardTasks = useMemo(() => {
    if (!rangeActive) return visibleTasks;
    return visibleTasks.filter((t) => t.dueDate && dayOf(t.dueDate) >= from && dayOf(t.dueDate) <= to);
  }, [visibleTasks, rangeActive, from, to]);

  const workload = useMemo(() => {
    if (!rangeActive) return null;
    const inRange = tasks.filter((t) => t.dueDate && dayOf(t.dueDate) >= from && dayOf(t.dueDate) <= to);
    const done = inRange.filter((t) => t.status === 'completed').length;
    const overdue = inRange.filter((t) => new Date(t.dueDate!).getTime() < now && t.status !== 'completed').length;
    return { total: inRange.length, done, left: inRange.length - done, overdue };
  }, [tasks, rangeActive, from, to, now]);

  const handleDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (e.over && workspace && e.active.id !== e.over.id) {
      void updateTask(workspace.id, e.active.id as string, { status: e.over.id as string });
    }
  };

  const dateCls = 'bg-background border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-purple transition-colors';

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <CalendarRange size={14} />
          <span className="font-medium">Workload</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={dateCls} />
          <span className="text-text-disabled">→</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={dateCls} />
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); }} className="text-text-secondary hover:text-text-primary" title="Clear date range">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <SortButton />
          <FilterButton />
          <AssigneeButton />
          <AddStatusButton kind="task" />
          <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors">
            <Plus size={13} /> Add Task
          </button>
        </div>
      </div>

      {rangeActive && workload && (
        <div className="px-4 py-2 border-b border-border shrink-0 text-sm flex flex-wrap items-center gap-x-5 gap-y-1 bg-black/[0.015]">
          <span className="font-semibold">Showing tasks due {fmt(from)} – {fmt(to)}</span>
          <span className="text-text-secondary"><b className="text-text-primary tabular-nums">{workload.total}</b> task{workload.total === 1 ? '' : 's'}</span>
          <span className="text-text-secondary"><b className="text-text-primary tabular-nums">{workload.done}</b> done</span>
          <span className="text-text-secondary"><b className="text-text-primary tabular-nums">{workload.left}</b> left</span>
          {workload.overdue > 0 && <span className="text-accent-red font-medium">{workload.overdue} overdue</span>}
        </div>
      )}

      {tasks.length === 0 ? <EmptyState /> : (
        <DndContext sensors={sensors} onDragStart={(e) => setDragging(boardTasks.find((t) => t.id === e.active.id) ?? null)} onDragEnd={handleDragEnd}>
          {rangeActive && boardTasks.length === 0 && (
            <p className="px-4 py-6 text-sm text-text-secondary">No tasks are due between {fmt(from)} and {fmt(to)}.</p>
          )}
          <div
            className="grid gap-3 p-4 flex-1 min-h-0 overflow-y-auto"
            style={{ gridTemplateColumns: `repeat(${statuses.length || 1}, minmax(0, 1fr))` }}
          >
            {statuses.map((s) => (
              <DroppableColumn key={s.key} status={s} statuses={statuses} tasks={boardTasks.filter((t) => t.status === s.key)} />
            ))}
          </div>
          <DragOverlay>
            {dragging && (
              <div className="bg-surface border border-accent-purple/40 rounded-xl p-3 w-[240px] shadow-2xl rotate-2 flex items-center gap-2">
                <StatusDot color={statuses.find((s) => s.key === dragging.status)?.color ?? '#64748B'} />
                <p className="text-sm text-text-primary">{dragging.name}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
