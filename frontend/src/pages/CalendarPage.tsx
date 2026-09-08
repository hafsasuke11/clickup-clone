import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTaskStore, getVisibleTasks } from '@/store/taskStore';
import { useUiStore } from '@/store/uiStore';
import { useCan } from '@/utils/permissions';
import { FilterButton, AssigneeButton } from '@/components/TaskToolbar';
import type { TaskPriority } from '@/utils/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const priorityDot: Record<TaskPriority, string> = {
  urgent: 'bg-accent-red', high: 'bg-accent-amber', normal: 'bg-accent-blue', low: 'bg-gray-400',
};

export default function CalendarPage() {
  const store = useTaskStore();
  const { setSelectedTaskId, setCreateModalOpen, setCreateModalDueDate, setCreateModalTaskOnly } = useUiStore();
  const canAddTask = useCan('manageTasks');
  const tasks = getVisibleTasks(store);
  const projectById = new Map(store.projects.map((p) => [p.id, p]));
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: Array<{ date: Date | null; isCurrentMonth: boolean }> = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const extra = cells.length - daysInMonth - firstDay + 1;
    cells.push({ date: new Date(year, month + 1, extra), isCurrentMonth: false });
  }

  const getTasksForDate = (date: Date) =>
    tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
    });

  const isToday = (date: Date) =>
    date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-text-secondary hover:text-text-primary transition-colors">Today</button>
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg border border-border bg-background text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg border border-border bg-background text-text-secondary hover:text-text-primary transition-colors">
            <ChevronRight size={14} />
          </button>
          <span className="text-sm font-bold text-text-primary px-1">{MONTHS[month]} {year}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FilterButton />
          <AssigneeButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-border" style={{ gridAutoRows: '1fr' }}>
          {cells.map((cell, idx) => {
            const cellTasks = cell.date ? getTasksForDate(cell.date) : [];
            const isTodayCell = cell.date ? isToday(cell.date) : false;
            return (
              <div key={idx}
                className={`min-h-[100px] p-2 border-b border-border relative group/cell transition-colors ${
                  cell.isCurrentMonth ? 'bg-surface hover:bg-black/[0.015]' : 'bg-black/[0.015]'
                }`}>
                {cell.date && (
                  <>
                    <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                      isTodayCell ? 'bg-accent-purple text-white' : cell.isCurrentMonth ? 'text-text-secondary hover:text-text-primary' : 'text-text-disabled'
                    }`}>
                      {cell.date.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {cellTasks.slice(0, 3).map((t) => {
                        const project = t.projectId ? projectById.get(t.projectId) : undefined;
                        return (
                          <button key={t.id} onClick={() => setSelectedTaskId(t.id)}
                            title={project ? `${t.name} · ${project.name}` : t.name}
                            style={project ? { borderLeft: `2px solid ${project.color}` } : undefined}
                            className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-left hover:opacity-80 transition-opacity bg-accent-purple/10">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[t.priority]}`} />
                            <span className="text-[11px] text-text-primary truncate">
                              {t.name}
                              {project && <span className="text-text-secondary"> · {project.name}</span>}
                            </span>
                          </button>
                        );
                      })}
                      {cellTasks.length > 3 && (
                        <p className="text-[10px] text-text-secondary px-1">+{cellTasks.length - 3} more</p>
                      )}
                    </div>
                    {canAddTask && (
                      <button
                        onClick={() => {
                          setCreateModalDueDate(cell.date!.toISOString().split('T')[0]);
                          setCreateModalTaskOnly(true);
                          setCreateModalOpen(true);
                        }}
                        title="Add task on this day"
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent-purple text-white flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                        <Plus size={11} />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
