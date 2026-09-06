import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { Plus, Calendar, LayoutDashboard } from 'lucide-react';
import { useTaskStore, getVisibleTasks } from '@/store/taskStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { FilterButton, AssigneeButton, SortButton } from '@/components/TaskToolbar';
import { StatusPill, STATUS_META, TASK_STATUS_ORDER } from '@/components/TaskStatusPill';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Task, TaskStatus, TaskPriority } from '@/utils/types';

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'text-red-700 bg-red-50 border-red-200',
  high: 'text-orange-700 bg-orange-50 border-orange-200',
  normal: 'text-blue-700 bg-blue-50 border-blue-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

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
      <p className="text-sm text-text-primary leading-snug">{task.name}</p>
      <div className="flex items-center justify-between pt-1">
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

function DroppableColumn({ status, tasks }: { status: TaskStatus; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { setSelectedTaskId } = useUiStore();
  const meta = STATUS_META[status];
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-[240px] max-w-[300px] flex flex-col rounded-2xl transition-all p-1.5 -m-1.5 ${isOver ? `${meta.bg} ring-1 ${meta.border}` : ''}`}>
      <div className={`h-[3px] rounded-full mb-3 ${meta.dot} opacity-80`} />
      <div className="flex items-center gap-2 mb-3 px-1">
        <StatusPill status={status} size="sm" />
        <span className="text-xs text-text-secondary bg-black/[0.04] rounded-full px-1.5 py-0.5 ml-auto tabular-nums">{tasks.length}</span>
      </div>
      <div className="space-y-2 flex-1">
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
  const { setCreateModalOpen } = useUiStore();
  const visibleTasks = getVisibleTasks(store);
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (e.over && workspace && e.active.id !== e.over.id) {
      void updateTask(workspace.id, e.active.id as string, { status: e.over.id as TaskStatus });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <SortButton />
          <FilterButton />
          <AssigneeButton />
          <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors">
            <Plus size={13} /> Add Task
          </button>
        </div>
      </div>
      {tasks.length === 0 ? <EmptyState /> : (
        <DndContext sensors={sensors} onDragStart={(e) => setDragging(visibleTasks.find((t) => t.id === e.active.id) ?? null)} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 p-5 flex-1 overflow-x-auto">
            {TASK_STATUS_ORDER.map((status) => (
              <DroppableColumn key={status} status={status} tasks={visibleTasks.filter((t) => t.status === status)} />
            ))}
          </div>
          <DragOverlay>
            {dragging && (
              <div className="bg-surface border border-accent-purple/40 rounded-xl p-3 w-[240px] shadow-2xl rotate-2">
                <p className="text-sm text-text-primary">{dragging.name}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
