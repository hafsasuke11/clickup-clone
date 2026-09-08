import { useEffect, useMemo, useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, useDroppable, closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, ChevronDown, ChevronRight, CheckSquare, GripVertical, CalendarRange, X } from 'lucide-react';
import { useTaskStore, getVisibleTasks } from '@/store/taskStore';
import { useCan } from '@/utils/permissions';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { FilterButton, AssigneeButton, SortButton } from '@/components/TaskToolbar';
import { StatusPill, StatusSelect } from '@/components/TaskStatusPill';
import { AddStatusButton, StatusColumnMenu } from '@/components/StatusManager';
import TaskContextMenu from '@/components/TaskContextMenu';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Member, Task, TaskPriority, TaskStatus, WorkspaceStatus } from '@/utils/types';

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'text-red-700 bg-red-50 border-red-200',
  high: 'text-orange-700 bg-orange-50 border-orange-200',
  normal: 'text-blue-700 bg-blue-50 border-blue-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

const dayOf = (iso: string) => iso.split('T')[0];
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateInputCls =
  'bg-background border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-purple transition-colors';

type Groups = Record<string, string[]>;

const buildGroups = (statuses: WorkspaceStatus[], tasks: Task[]): Groups => {
  const g: Groups = {};
  for (const s of statuses) g[s.key] = [];
  for (const t of tasks) (g[t.status] ??= []).push(t.id);
  return g;
};

const groupOf = (id: string, groups: Groups): string | null => {
  if (id in groups) return id;
  return Object.keys(groups).find((k) => groups[k].includes(id)) ?? null;
};

function EmptyState() {
  const { setCreateModalOpen } = useUiStore();
  const canManage = useCan('manageTasks');
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
      <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
        <CheckSquare size={28} className="text-accent-purple" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary">No tasks yet</h2>
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

function TaskRow({
  task, statuses, members, canManage, onOpen, onStatusChange, onOpenMenu,
}: {
  task: Task;
  statuses: WorkspaceStatus[];
  members: Member[];
  canManage: boolean;
  onOpen: () => void;
  onStatusChange: (s: TaskStatus) => void;
  onOpenMenu: (x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canManage });
  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
  const overdue = task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== 'completed' : false;
  const assigneeName = members.find((m) => m.userId === task.assigneeId)?.user?.fullName;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      onClick={onOpen}
      onContextMenu={(e) => { e.preventDefault(); onOpenMenu(e.clientX, e.clientY); }}
      className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-black/[0.02] transition-colors items-center cursor-pointer group/row"
    >
      <div className="col-span-4 flex items-center gap-2 min-w-0">
        {canManage && (
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="text-text-disabled hover:text-text-secondary cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-100 transition-opacity touch-none shrink-0"
            title="Drag to reorder or change status"
            aria-label="Drag task"
          >
            <GripVertical size={13} />
          </button>
        )}
        <CheckSquare size={13} className={task.status === 'completed' ? 'text-accent-green' : 'text-text-disabled'} />
        <span className={`text-sm truncate ${task.status === 'completed' ? 'line-through text-text-disabled' : 'text-text-primary'}`}>{task.name}</span>
      </div>
      <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
        {canManage
          ? <StatusSelect statuses={statuses} status={task.status} size="sm" onChange={onStatusChange} />
          : <StatusPill statuses={statuses} status={task.status} size="sm" />}
      </div>
      <div className="col-span-2">
        {task.assigneeId ? (
          <div className={`w-6 h-6 rounded-full ${colorFor(task.assigneeId)} flex items-center justify-center text-[10px] font-bold text-white`} title={assigneeName}>
            {assigneeName ? initialsOf(assigneeName) : '?'}
          </div>
        ) : <span className="text-xs text-text-disabled">—</span>}
      </div>
      <div className="col-span-2">
        {due ? <span className={`text-xs ${overdue ? 'text-accent-red' : 'text-text-secondary'}`}>{due}</span> : <span className="text-xs text-text-disabled">—</span>}
      </div>
      <div className="col-span-2">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${priorityColors[task.priority]}`}>{task.priority}</span>
      </div>
    </div>
  );
}

function StatusGroup({
  status, statuses, taskIds, taskById, members, canManage, collapsed, onToggle,
  onStartAdd, onOpenTask, onStatusChange, onOpenMenu,
}: {
  status: WorkspaceStatus;
  statuses: WorkspaceStatus[];
  taskIds: string[];
  taskById: Map<string, Task>;
  members: Member[];
  canManage: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onStartAdd: () => void;
  onOpenTask: (id: string) => void;
  onStatusChange: (id: string, s: TaskStatus) => void;
  onOpenMenu: (id: string, x: number, y: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.key });

  return (
    <div ref={setNodeRef} className="rounded-xl transition-colors" style={isOver ? { boxShadow: `0 0 0 2px ${status.color}55` } : undefined}>
      <div className="flex items-center gap-2 mb-2.5 group">
        <button onClick={onToggle} className="text-text-secondary hover:text-text-primary transition-colors">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <StatusPill statuses={statuses} status={status.key} />
        <span className="text-xs text-text-secondary bg-black/[0.04] px-2 py-0.5 rounded-full font-semibold tabular-nums">{taskIds.length}</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          <StatusColumnMenu kind="task" statusKey={status.key} align="left" />
        </span>
      </div>
      {!collapsed && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden" style={{ borderTopColor: status.color, borderTopWidth: 2 }}>
          <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs text-text-secondary font-semibold uppercase tracking-wider border-b border-border">
            <div className="col-span-4">Name</div><div className="col-span-2">Status</div>
            <div className="col-span-2">Assignee</div><div className="col-span-2">Due Date</div>
            <div className="col-span-2">Priority</div>
          </div>
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {taskIds.map((id) => {
              const t = taskById.get(id);
              return t ? (
                <TaskRow
                  key={id}
                  task={t}
                  statuses={statuses}
                  members={members}
                  canManage={canManage}
                  onOpen={() => onOpenTask(id)}
                  onStatusChange={(s) => onStatusChange(id, s)}
                  onOpenMenu={(x, y) => onOpenMenu(id, x, y)}
                />
              ) : null;
            })}
          </SortableContext>
          {canManage && (
            <button onClick={onStartAdd}
              className="w-full px-4 py-2.5 text-left text-sm text-text-secondary hover:text-text-primary hover:bg-black/[0.02] transition-colors flex items-center gap-2">
              <Plus size={13} /> Add Task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ListPage() {
  const store = useTaskStore();
  const { tasks, updateTask, reorderTasks } = store;
  const { workspace, members } = useWorkspaceStore();
  const statuses = useTaskStatuses();
  const { setSelectedTaskId, setCreateModalOpen, setCreateModalStatus } = useUiStore();
  const canManage = useCan('manageTasks');
  const visibleTasks = getVisibleTasks(store);
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set());
  const [dragGroups, setDragGroups] = useState<Groups | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const rangeActive = Boolean(fromDate && toDate && fromDate <= toDate);

  // The Due date filter narrows the list to tasks due within the range; tasks
  // with no due date are hidden while it's active.
  const rangedTasks = useMemo(() => {
    if (!rangeActive) return visibleTasks;
    return visibleTasks.filter((t) => t.dueDate && dayOf(t.dueDate) >= fromDate && dayOf(t.dueDate) <= toDate);
  }, [visibleTasks, rangeActive, fromDate, toDate]);

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  const menuTask = menu ? taskById.get(menu.id) ?? null : null;

  // If the task behind an open menu disappears (deleted), drop the menu.
  useEffect(() => {
    if (menu && !menuTask) setMenu(null);
  }, [menu, menuTask]);

  const derived = useMemo(() => buildGroups(statuses, rangedTasks), [statuses, rangedTasks]);
  const groups = dragGroups ?? derived;

  const toggleCollapsed = (status: TaskStatus) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

  const handleDragStart = () => setDragGroups(derived);

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const draggedId = String(active.id);
    const overId = String(over.id);
    setDragGroups((prev) => {
      const g = prev ?? derived;
      const src = groupOf(draggedId, g);
      const dst = groupOf(overId, g);
      if (!src || !dst || src === dst) return prev;
      const overItems = g[dst];
      const overIdx = overId in g ? overItems.length : overItems.indexOf(overId);
      const insertAt = overIdx < 0 ? overItems.length : overIdx;
      return {
        ...g,
        [src]: g[src].filter((id) => id !== draggedId),
        [dst]: [...overItems.slice(0, insertAt), draggedId, ...overItems.slice(insertAt)],
      };
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    const draggedId = String(active.id);
    const g = dragGroups ?? derived;
    const src = groupOf(draggedId, g);
    if (!over || !workspace || !src) { setDragGroups(null); return }

    const overId = String(over.id);
    const dst = groupOf(overId, g);
    if (!dst) { setDragGroups(null); return }

    let next = g;
    if (src === dst) {
      const items = g[dst];
      const oldIndex = items.indexOf(draggedId);
      const newIndex = overId in g ? items.length - 1 : items.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        next = { ...g, [dst]: arrayMove(items, oldIndex, newIndex) };
      }
    }

    if (src === dst && next === g) { setDragGroups(null); return }

    void reorderTasks(workspace.id, dst, next[dst]);
    setDragGroups(null);
  };

  // "Add Task" in a status group opens the full create-task modal (same one used
  // everywhere else), with this group's status pre-selected so the new task
  // lands in the right place.
  const openCreateForStatus = (status: TaskStatus) => {
    setCreateModalStatus(status);
    setCreateModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <CalendarRange size={14} />
          <span className="font-medium">Due date</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className={dateInputCls}
            title="Show tasks due on or after"
          />
          <span className="text-text-disabled">→</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className={dateInputCls}
            title="Show tasks due on or before"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="text-text-secondary hover:text-text-primary"
              title="Clear date filter"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <SortButton />
          <FilterButton />
          <AssigneeButton />
          <AddStatusButton kind="task" />
        </div>
      </div>

      {tasks.length === 0 ? <EmptyState /> : (
        <div className="flex-1 overflow-y-auto p-5">
          {rangeActive && rangedTasks.length === 0 && (
            <p className="text-sm text-text-secondary bg-surface border border-border rounded-xl px-4 py-6 text-center mb-5">
              No tasks are due between {fmtDay(fromDate)} and {fmtDay(toDate)}.
            </p>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragGroups(null)}
          >
            <div className="space-y-5">
              {statuses.map((s) => (
                <StatusGroup
                  key={s.key}
                  status={s}
                  statuses={statuses}
                  taskIds={groups[s.key] ?? []}
                  taskById={taskById}
                  members={members}
                  canManage={canManage}
                  collapsed={collapsed.has(s.key)}
                  onToggle={() => toggleCollapsed(s.key)}
                  onStartAdd={() => openCreateForStatus(s.key)}
                  onOpenTask={setSelectedTaskId}
                  onStatusChange={(id, st) => workspace && updateTask(workspace.id, id, { status: st })}
                  onOpenMenu={(id, x, y) => setMenu({ id, x, y })}
                />
              ))}
            </div>
          </DndContext>
        </div>
      )}

      {menu && menuTask && (
        <TaskContextMenu
          task={menuTask}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onView={() => setSelectedTaskId(menuTask.id)}
          onEdit={() => setSelectedTaskId(menuTask.id)}
        />
      )}
    </div>
  );
}
