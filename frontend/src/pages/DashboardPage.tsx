import { AlertTriangle, Clock, Users, ListChecks } from 'lucide-react';
import { useTaskStore, getVisibleTasks } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { FilterButton, AssigneeButton } from '@/components/TaskToolbar';
import { StatusDot, resolveStatus } from '@/components/TaskStatusPill';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';

export default function DashboardPage() {
  const store = useTaskStore();
  const tasks = getVisibleTasks(store);
  const { members } = useWorkspaceStore();
  const statuses = useTaskStatuses();
  const { setSelectedTaskId } = useUiStore();

  const now = new Date();
  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed');
  const upcoming = tasks
    .filter((t) => t.dueDate && t.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 8);
  const recentlyUpdated = [...tasks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

  const workload = members.map((m) => ({
    member: m,
    count: tasks.filter((t) => t.assigneeId === m.userId && t.status !== 'completed').length,
  })).sort((a, b) => b.count - a.count);
  const maxWorkload = Math.max(1, ...workload.map((w) => w.count));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <FilterButton />
          <AssigneeButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Status tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {statuses.map((s) => {
          const count = tasks.filter((t) => t.status === s.key).length;
          return (
            <div key={s.key} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <StatusDot color={s.color} />
                <span className="text-xs font-medium text-text-secondary">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{count}</p>
            </div>
          );
        })}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-accent-red" />
            <span className="text-xs font-medium text-text-secondary">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-accent-red">{overdue.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming due dates */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Clock size={14} className="text-text-secondary" />
            <span className="text-sm font-semibold text-text-primary">Upcoming Due Dates</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-8 text-center">Nothing due soon.</p>
          ) : (
            <div className="divide-y divide-border">
              {upcoming.map((t) => {
                const overdueTask = new Date(t.dueDate!) < now;
                return (
                  <button key={t.id} onClick={() => setSelectedTaskId(t.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-black/[0.02] transition-colors text-left">
                    <span className="text-sm text-text-primary truncate">{t.name}</span>
                    <span className={`text-xs shrink-0 ml-3 ${overdueTask ? 'text-accent-red' : 'text-text-secondary'}`}>
                      {new Date(t.dueDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Workload by member */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Users size={14} className="text-text-secondary" />
            <span className="text-sm font-semibold text-text-primary">Workload by Member</span>
          </div>
          {workload.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-8 text-center">No members yet.</p>
          ) : (
            <div className="p-4 space-y-3">
              {workload.map(({ member, count }) => (
                <div key={member.userId} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full ${colorFor(member.userId)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                    {member.user ? initialsOf(member.user.fullName) : '?'}
                  </div>
                  <span className="text-xs text-text-secondary w-24 truncate shrink-0">{member.user?.fullName}</span>
                  <div className="flex-1 h-2 bg-black/[0.05] rounded-full overflow-hidden">
                    <div className="h-full bg-accent-purple rounded-full transition-all" style={{ width: `${(count / maxWorkload) * 100}%` }} />
                  </div>
                  <span className="text-xs text-text-secondary tabular-nums w-5 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recently updated */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <ListChecks size={14} className="text-text-secondary" />
          <span className="text-sm font-semibold text-text-primary">Recently Updated</span>
        </div>
        {recentlyUpdated.length === 0 ? (
          <p className="text-sm text-text-secondary px-4 py-8 text-center">No activity yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentlyUpdated.map((t) => (
              <button key={t.id} onClick={() => setSelectedTaskId(t.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-black/[0.02] transition-colors text-left">
                <span className="text-sm text-text-primary truncate">{t.name}</span>
                <span className="text-xs text-text-secondary shrink-0 ml-3">{resolveStatus(statuses, t.status).label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
