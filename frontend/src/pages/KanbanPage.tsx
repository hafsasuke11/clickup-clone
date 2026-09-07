import { useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Calendar, LayoutDashboard, CalendarRange, X, Eye } from 'lucide-react';
import { useTaskStore, getVisibleTasks } from '@/store/taskStore';
import { useCan } from '@/utils/permissions';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { FilterButton, AssigneeButton, SortButton } from '@/components/TaskToolbar';
import { StatusPill, StatusDot } from '@/components/TaskStatusPill';
import { StatusColumnMenu, AddStatusButton } from '@/components/StatusManager';
import { describeTaskActivity } from '@/utils/activityText';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Task, TaskPriority, WorkspaceStatus } from '@/utils/types';

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'text-red-700 bg-red-50 border-red-200',
  high: 'text-orange-700 bg-orange-50 border-orange-200',
  normal: 'text-blue-700 bg-blue-50 border-blue-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayOf = (iso: string) => iso.split('T')[0];

type Columns = Record<string, string[]>;

const buildColumns = (statuses: WorkspaceStatus[], tasks: Task[]): Columns => {
  const cols: Columns = {};
  for (const s of statuses) cols[s.key] = [];
  for (const t of tasks) (cols[t.status] ??= []).push(t.id);
  return cols;
};

const columnOf = (id: string, cols: Columns): string | null => {
  if (id in cols) return id;
  return Object.keys(cols).find((k) => cols[k].includes(id)) ?? null;
};

/**
 * The read-only "quick peek" that opens under a card when its eye icon is
 * tapped. Editing lives in the full drawer (a click on the card body opens it);
 * this panel is a glanceable summary only.
 */
function TaskCardDetails({ task }: { task: Task }) {
  const { projects, taskActivity } = useTaskStore();
  const { members } = useWorkspaceStore();
  const statuses = useTaskStatuses();

  const assignee = members.find((m) => m.userId === task.assigneeId)?.user;
  const project = projects.find((p) => p.id === task.projectId);
  const history = taskActivity.filter((e) => e.taskId === task.id);
  const statusLabel = (k: string) => statuses.find((s) => s.key === k)?.label ?? k;
  const projectNameOf = (id: string | null) => (id ? (projects.find((p) => p.id === id)?.name ?? 'a project') : 'No project');
  const memberName = (id: string) => members.find((m) => m.userId === id)?.user?.fullName ?? 'another member';

  return (
    <div className="border-t border-border bg-black/[0.015] px-3 py-3 space-y-3 text-xs cursor-default">
      <p className="text-sm font-semibold text-text-primary break-words">{task.name}</p>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-text-secondary mb-1">Description</p>
        <p className="text-text-primary whitespace-pre-wrap break-words">
          {task.description || <span className="text-text-disabled">No description</span>}
        </p>
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-text-secondary">Assignee</dt>
        <dd className="text-text-primary min-w-0">
          {assignee ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-4 h-4 rounded-full ${colorFor(task.assigneeId!)} flex items-center justify-center text-[8px] font-bold text-white`}>{initialsOf(assignee.fullName)}</span>
              {assignee.fullName}
            </span>
          ) : <span className="text-text-disabled">Unassigned</span>}
        </dd>

        <dt className="text-text-secondary">Project</dt>
        <dd className="text-text-primary min-w-0 truncate">{project ? project.name : <span className="text-text-disabled">No project</span>}</dd>

        <dt className="text-text-secondary">Status</dt>
        <dd><StatusPill statuses={statuses} status={task.status} size="sm" /></dd>

        <dt className="text-text-secondary">Priority</dt>
        <dd>
          <span className={`px-1.5 py-0.5 rounded-full border font-medium capitalize ${priorityColors[task.priority]}`}>{task.priority}</span>
        </dd>

        <dt className="text-text-secondary">Due date</dt>
        <dd className="text-text-primary">{task.dueDate ? fmt(task.dueDate) : <span className="text-text-disabled">None</span>}</dd>

        <dt className="text-text-secondary">Created</dt>
        <dd className="text-text-primary">{fmt(task.createdAt)}</dd>

        <dt className="text-text-secondary">Last updated</dt>
        <dd className="text-text-primary">{fmt(task.updatedAt)}</dd>
      </dl>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-text-secondary mb-1">Activity / history</p>
        {history.length === 0 ? (
          <p className="text-text-disabled">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-1">
            {history.slice(0, 8).map((e) => (
              <li key={e.id} className="text-text-secondary leading-snug">
                <span className="font-medium text-text-primary">{e.actor?.fullName ?? 'Someone'}</span>{' '}
                {describeTaskActivity(e, statusLabel, projectNameOf, memberName)}
                <span className="text-text-disabled"> · {dateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-text-disabled pt-0.5">Click the card to open the full, editable view.</p>
    </div>
  );
}

function SortableCard({ task, expanded, canDrag, onToggle }: { task: Task; expanded: boolean; canDrag: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canDrag });
  const { members } = useWorkspaceStore();
  const { setSelectedTaskId } = useUiStore();
  const assignee = members.find((m) => m.userId === task.assigneeId)?.user;
  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
  const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== 'completed' : false;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      className={`bg-surface border rounded-xl transition-all select-none ${
        expanded ? 'border-accent-purple/40 shadow-sm' : 'border-border hover:border-accent-purple/40 hover:shadow-sm'
      }`}
    >
      {/* Compact header — click opens the full drawer; also the drag handle */}
      <div {...attributes} {...listeners} onClick={() => setSelectedTaskId(task.id)} className="p-3 space-y-2 cursor-pointer">
        <div className="flex items-start gap-1.5">
          <p className="text-sm text-text-primary leading-snug break-words flex-1 min-w-0">{task.name}</p>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            title={expanded ? 'Hide quick view' : 'Quick view'}
            aria-label={expanded ? 'Hide quick view' : 'Quick view'}
            aria-pressed={expanded}
            className={`shrink-0 -mt-0.5 -mr-1 p-1 rounded-md transition-colors ${
              expanded ? 'text-accent-purple bg-accent-purple/10' : 'text-text-disabled hover:text-text-secondary hover:bg-black/[0.04]'
            }`}
          >
            <Eye size={13} />
          </button>
        </div>
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

      {expanded && <TaskCardDetails task={task} />}
    </div>
  );
}

function DroppableColumn({
  status, statuses, taskIds, taskById, expandedId, canDrag, onToggleExpand,
}: {
  status: WorkspaceStatus;
  statuses: WorkspaceStatus[];
  taskIds: string[];
  taskById: Map<string, Task>;
  expandedId: string | null;
  canDrag: boolean;
  onToggleExpand: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.key });
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
        <span className="text-xs text-text-secondary bg-black/[0.04] rounded-full px-1.5 py-0.5 tabular-nums shrink-0">{taskIds.length}</span>
        <div className="ml-auto shrink-0">
          <StatusColumnMenu kind="task" statusKey={status.key} />
        </div>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1 min-h-[40px]">
          {taskIds.map((id) => {
            const t = taskById.get(id);
            return t ? (
              <SortableCard key={id} task={t} expanded={expandedId === id} canDrag={canDrag} onToggle={() => onToggleExpand(id)} />
            ) : null;
          })}
        </div>
      </SortableContext>
    </div>
  );
}

function EmptyState() {
  const { setCreateModalOpen } = useUiStore();
  const canManage = useCan('manageTasks');
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
      <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
        <LayoutDashboard size={28} className="text-accent-purple" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary">Your board is empty</h2>
      <p className="text-sm text-text-secondary">
        {canManage ? 'Create your first task to get started.' : 'No tasks yet.'}
      </p>
      {canManage && (
        <button onClick={() => setCreateModalOpen(true)} className="px-4 py-2 bg-accent-purple text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
          Add Task
        </button>
      )}
    </div>
  );
}

export default function KanbanPage() {
  const store = useTaskStore();
  const { tasks, reorderTasks, fetchTaskActivity } = store;
  const canManage = useCan('manageTasks');
  const { workspace } = useWorkspaceStore();
  const statuses = useTaskStatuses();
  const { setCreateModalOpen } = useUiStore();
  const visibleTasks = getVisibleTasks(store);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragBoard, setDragBoard] = useState<Columns | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load activity so an expanded card can show its history.
  useEffect(() => {
    if (workspace) void fetchTaskActivity(workspace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const rangeActive = Boolean(from && to && from <= to);
  const now = Date.now();

  // When a Workload range is set, the board only shows tasks whose due date
  // falls inside that period (tasks with no due date are hidden).
  const boardTasks = useMemo(() => {
    if (!rangeActive) return visibleTasks;
    return visibleTasks.filter((t) => t.dueDate && dayOf(t.dueDate) >= from && dayOf(t.dueDate) <= to);
  }, [visibleTasks, rangeActive, from, to]);

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  // Columns derived from the store; a live snapshot (`dragBoard`) takes over
  // only while a card is being dragged so the layout can shift under the cursor.
  const derived = useMemo(() => buildColumns(statuses, boardTasks), [statuses, boardTasks]);
  const board = dragBoard ?? derived;

  const workload = useMemo(() => {
    if (!rangeActive) return null;
    const inRange = tasks.filter((t) => t.dueDate && dayOf(t.dueDate) >= from && dayOf(t.dueDate) <= to);
    const done = inRange.filter((t) => t.status === 'completed').length;
    const overdue = inRange.filter((t) => new Date(t.dueDate!).getTime() < now && t.status !== 'completed').length;
    return { total: inRange.length, done, left: inRange.length - done, overdue };
  }, [tasks, rangeActive, from, to, now]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setExpandedId(null);
    setDragBoard(derived);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const draggedId = String(active.id);
    const overId = String(over.id);
    setDragBoard((prev) => {
      const cols = prev ?? derived;
      const src = columnOf(draggedId, cols);
      const dst = columnOf(overId, cols);
      if (!src || !dst || src === dst) return prev;
      const overItems = cols[dst];
      const overIdx = overId in cols ? overItems.length : overItems.indexOf(overId);
      const insertAt = overIdx < 0 ? overItems.length : overIdx;
      return {
        ...cols,
        [src]: cols[src].filter((id) => id !== draggedId),
        [dst]: [...overItems.slice(0, insertAt), draggedId, ...overItems.slice(insertAt)],
      };
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    const draggedId = String(active.id);
    const cols = dragBoard ?? derived;
    const src = columnOf(draggedId, cols);

    setActiveId(null);
    if (!over || !workspace || !src) { setDragBoard(null); return }

    const overId = String(over.id);
    const dst = columnOf(overId, cols);
    if (!dst) { setDragBoard(null); return }

    let next = cols;
    if (src === dst) {
      const items = cols[dst];
      const oldIndex = items.indexOf(draggedId);
      const newIndex = overId in cols ? items.length - 1 : items.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        next = { ...cols, [dst]: arrayMove(items, oldIndex, newIndex) };
      }
    }

    const moved = src !== dst || next !== cols;
    if (!moved) { setDragBoard(null); return }

    // Persist the destination column's order (which also carries the moved card's
    // new status). The source column's remaining cards keep their relative order.
    void reorderTasks(workspace.id, dst, next[dst]);
    setDragBoard(null);
  };

  const dateCls = 'bg-background border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-purple transition-colors';
  const activeTask = activeId ? taskById.get(activeId) : null;

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
          {canManage ? (
            <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors">
              <Plus size={13} /> Add Task
            </button>
          ) : (
            <span className="text-[11px] text-text-disabled">View only</span>
          )}
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setActiveId(null); setDragBoard(null); }}
        >
          {rangeActive && boardTasks.length === 0 && (
            <p className="px-4 py-6 text-sm text-text-secondary">No tasks are due between {fmt(from)} and {fmt(to)}.</p>
          )}
          <div
            className="grid gap-3 p-4 flex-1 min-h-0 overflow-y-auto"
            style={{ gridTemplateColumns: `repeat(${statuses.length || 1}, minmax(0, 1fr))` }}
          >
            {statuses.map((s) => (
              <DroppableColumn
                key={s.key}
                status={s}
                statuses={statuses}
                taskIds={board[s.key] ?? []}
                taskById={taskById}
                expandedId={expandedId}
                canDrag={canManage}
                onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && (
              <div className="bg-surface border border-accent-purple/40 rounded-xl p-3 w-[240px] shadow-2xl rotate-2 flex items-center gap-2">
                <StatusDot color={statuses.find((s) => s.key === activeTask.status)?.color ?? '#64748B'} />
                <p className="text-sm text-text-primary">{activeTask.name}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
