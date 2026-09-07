import { useMemo, useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, useDroppable, closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, ChevronDown, ChevronRight, CheckSquare, GripVertical, AlertTriangle } from 'lucide-react';
import { useTaskStore, getVisibleTasks, findDuplicateTask, type DuplicateTaskInfo } from '@/store/taskStore';
import { useCan } from '@/utils/permissions';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { FilterButton, AssigneeButton, SortButton } from '@/components/TaskToolbar';
import { StatusPill, StatusSelect } from '@/components/TaskStatusPill';
import { AddStatusButton, StatusColumnMenu } from '@/components/StatusManager';
import ConfirmDialog from '@/components/ConfirmDialog';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Member, Task, TaskPriority, TaskStatus, WorkspaceStatus } from '@/utils/types';

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'text-red-700 bg-red-50 border-red-200',
  high: 'text-orange-700 bg-orange-50 border-orange-200',
  normal: 'text-blue-700 bg-blue-50 border-blue-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

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
  task, statuses, members, canManage, onOpen, onStatusChange,
}: {
  task: Task;
  statuses: WorkspaceStatus[];
  members: Member[];
  canManage: boolean;
  onOpen: () => void;
  onStatusChange: (s: TaskStatus) => void;
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
  status, statuses, taskIds, taskById, members, canManage, collapsed, onToggle, isAdding,
  newName, setNewName, onStartAdd, onCancelAdd, onCreate, onOpenTask, onStatusChange, duplicateHint,
}: {
  status: WorkspaceStatus;
  statuses: WorkspaceStatus[];
  taskIds: string[];
  taskById: Map<string, Task>;
  members: Member[];
  canManage: boolean;
  collapsed: boolean;
  onToggle: () => void;
  isAdding: boolean;
  newName: string;
  setNewName: (v: string) => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onCreate: () => void;
  onOpenTask: (id: string) => void;
  onStatusChange: (id: string, s: TaskStatus) => void;
  duplicateHint: string | null;
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
                />
              ) : null;
            })}
          </SortableContext>
          {isAdding ? (
            <div className="border-t border-border">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <CheckSquare size={13} className="text-text-disabled" />
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCreate();
                    if (e.key === 'Escape') onCancelAdd();
                  }}
                  placeholder="Task name..."
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none" />
                <button onClick={onCancelAdd} className="text-xs text-text-secondary hover:text-text-primary">Cancel</button>
              </div>
              {duplicateHint && (
                <p className="flex items-center gap-1.5 px-4 pb-2 -mt-1 text-[11px] text-accent-amber">
                  <AlertTriangle size={12} className="shrink-0" />
                  “{duplicateHint}” already exists in this group — pressing Enter will ask to confirm.
                </p>
              )}
            </div>
          ) : canManage ? (
            <button onClick={onStartAdd}
              className="w-full px-4 py-2.5 text-left text-sm text-text-secondary hover:text-text-primary hover:bg-black/[0.02] transition-colors flex items-center gap-2">
              <Plus size={13} /> Add Task
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ListPage() {
  const store = useTaskStore();
  const { tasks, createTask, updateTask, reorderTasks } = store;
  const { workspace, members } = useWorkspaceStore();
  const statuses = useTaskStatuses();
  const { setSelectedTaskId } = useUiStore();
  const canManage = useCan('manageTasks');
  const visibleTasks = getVisibleTasks(store);
  const [addingIn, setAddingIn] = useState<TaskStatus | null>(null);
  const [newName, setNewName] = useState('');
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set());
  const [dragGroups, setDragGroups] = useState<Groups | null>(null);
  const [dupPrompt, setDupPrompt] = useState<{ status: TaskStatus; info: DuplicateTaskInfo } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  const derived = useMemo(() => buildGroups(statuses, visibleTasks), [statuses, visibleTasks]);
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

  const createInStatus = async (status: TaskStatus, force = false) => {
    if (!newName.trim() || !workspace) return;
    const res = await createTask(workspace.id, { name: newName.trim(), status }, { force });
    if ('duplicate' in res) {
      setDupPrompt({ status, info: res.duplicate });
      return;
    }
    setNewName('');
    setAddingIn(null);
    setDupPrompt(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <SortButton />
          <FilterButton />
          <AssigneeButton />
          <AddStatusButton kind="task" />
        </div>
      </div>

      {tasks.length === 0 ? <EmptyState /> : (
        <div className="flex-1 overflow-y-auto p-5">
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
                  isAdding={addingIn === s.key}
                  newName={newName}
                  setNewName={setNewName}
                  onStartAdd={() => setAddingIn(s.key)}
                  onCancelAdd={() => { setAddingIn(null); setNewName(''); setDupPrompt(null); }}
                  onCreate={() => { void createInStatus(s.key); }}
                  onOpenTask={setSelectedTaskId}
                  onStatusChange={(id, st) => workspace && updateTask(workspace.id, id, { status: st })}
                  duplicateHint={
                    addingIn === s.key && newName.trim()
                      ? (findDuplicateTask(tasks, newName, null)?.name ?? null)
                      : null
                  }
                />
              ))}
            </div>
          </DndContext>
        </div>
      )}

      {dupPrompt && (
        <ConfirmDialog
          title="This task already exists"
          message={`A task named “${dupPrompt.info.name}” already exists in this group. Adding it again will create a duplicate.`}
          confirmLabel="Add anyway"
          onConfirm={() => { void createInStatus(dupPrompt.status, true); }}
          onCancel={() => setDupPrompt(null)}
        />
      )}
    </div>
  );
}
