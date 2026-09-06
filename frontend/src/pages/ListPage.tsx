import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';
import { useTaskStore, getVisibleTasks } from '@/store/taskStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { FilterButton, AssigneeButton, SortButton } from '@/components/TaskToolbar';
import { StatusPill, STATUS_META, TASK_STATUS_ORDER } from '@/components/TaskStatusPill';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { TaskPriority, TaskStatus } from '@/utils/types';

const priorityColors: Record<TaskPriority, string> = {
  urgent: 'text-red-700 bg-red-50 border-red-200',
  high: 'text-orange-700 bg-orange-50 border-orange-200',
  normal: 'text-blue-700 bg-blue-50 border-blue-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
};

function EmptyState() {
  const { setCreateModalOpen } = useUiStore();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
      <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
        <CheckSquare size={28} className="text-accent-purple" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary">No tasks yet</h2>
      <p className="text-sm text-text-secondary">Create your first task to get started.</p>
      <button onClick={() => setCreateModalOpen(true)} className="px-4 py-2 bg-accent-purple text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
        Add Task
      </button>
    </div>
  );
}

export default function ListPage() {
  const store = useTaskStore();
  const { tasks, createTask } = store;
  const { workspace, members } = useWorkspaceStore();
  const { setSelectedTaskId } = useUiStore();
  const visibleTasks = getVisibleTasks(store);
  const [addingIn, setAddingIn] = useState<TaskStatus | null>(null);
  const [newName, setNewName] = useState('');
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set());

  const toggleCollapsed = (status: TaskStatus) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <SortButton />
          <FilterButton />
          <AssigneeButton />
        </div>
      </div>

      {tasks.length === 0 ? <EmptyState /> : (
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {TASK_STATUS_ORDER.map((status) => {
          const grouped = visibleTasks.filter((t) => t.status === status);
          const isCollapsed = collapsed.has(status);
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2.5">
                <button onClick={() => toggleCollapsed(status)} className="text-text-secondary hover:text-text-primary transition-colors">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <StatusPill status={status} />
                <span className="text-xs text-text-secondary bg-black/[0.04] px-2 py-0.5 rounded-full font-semibold tabular-nums">{grouped.length}</span>
              </div>
              {!isCollapsed && (
                <div className={`bg-surface border border-border border-t-2 ${STATUS_META[status].topBorder} rounded-xl overflow-hidden`}>
                  <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs text-text-secondary font-semibold uppercase tracking-wider border-b border-border">
                    <div className="col-span-5">Name</div><div className="col-span-2">Assignee</div>
                    <div className="col-span-2">Due Date</div><div className="col-span-3">Priority</div>
                  </div>
                  {grouped.map((task) => {
                    const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
                    const overdue = task.dueDate ? new Date(task.dueDate) < new Date() && task.status !== 'completed' : false;
                    return (
                      <div key={task.id} onClick={() => setSelectedTaskId(task.id)}
                        className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-black/[0.02] transition-colors items-center cursor-pointer">
                        <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                          <CheckSquare size={13} className={task.status === 'completed' ? 'text-accent-green' : 'text-text-disabled'} />
                          <span className={`text-sm truncate ${task.status === 'completed' ? 'line-through text-text-disabled' : 'text-text-primary'}`}>{task.name}</span>
                        </div>
                        <div className="col-span-2">
                          {task.assigneeId ? (
                            <div className={`w-6 h-6 rounded-full ${colorFor(task.assigneeId)} flex items-center justify-center text-[10px] font-bold text-white`} title={members.find((m) => m.userId === task.assigneeId)?.user?.fullName}>
                              {(() => {
                                const name = members.find((m) => m.userId === task.assigneeId)?.user?.fullName;
                                return name ? initialsOf(name) : '?';
                              })()}
                            </div>
                          ) : <span className="text-xs text-text-disabled">—</span>}
                        </div>
                        <div className="col-span-2">
                          {due ? <span className={`text-xs ${overdue ? 'text-accent-red' : 'text-text-secondary'}`}>{due}</span> : <span className="text-xs text-text-disabled">—</span>}
                        </div>
                        <div className="col-span-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${priorityColors[task.priority]}`}>{task.priority}</span>
                        </div>
                      </div>
                    );
                  })}
                  {addingIn === status ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
                      <CheckSquare size={13} className="text-text-disabled" />
                      <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newName.trim() && workspace) {
                            void createTask(workspace.id, { name: newName.trim(), status });
                            setNewName(''); setAddingIn(null);
                          }
                          if (e.key === 'Escape') { setAddingIn(null); setNewName(''); }
                        }}
                        placeholder="Task name..."
                        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none" />
                      <button onClick={() => { setAddingIn(null); setNewName(''); }} className="text-xs text-text-secondary hover:text-text-primary">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingIn(status)}
                      className="w-full px-4 py-2.5 text-left text-sm text-text-secondary hover:text-text-primary hover:bg-black/[0.02] transition-colors flex items-center gap-2">
                      <Plus size={13} /> Add Task
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
