import { useEffect, useMemo, useState } from 'react';
import { User as UserIcon, Mail, Building2, CalendarDays, ShieldCheck, Check, Minus, ListChecks, CircleCheck, CircleDot, AlertTriangle, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { StatusPill } from '@/components/TaskStatusPill';
import { PERMISSION_META, useMyMembership } from '@/utils/permissions';
import { describeTaskActivity } from '@/utils/activityText';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';

type TaskFilter = 'all' | 'open' | 'completed' | 'overdue';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const longDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const me = useMyMembership();
  const { workspace, members } = useWorkspaceStore();
  const { tasks, projects, taskActivity, taskActivityLoaded, fetchTaskActivity } = useTaskStore();
  const taskStatuses = useTaskStatuses();
  const { setSelectedTaskId } = useUiStore();
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  useEffect(() => {
    if (workspace && !taskActivityLoaded) void fetchTaskActivity(workspace.id);
  }, [workspace, taskActivityLoaded, fetchTaskActivity]);

  const isOwner = me?.role === 'owner';
  const completedKey = 'completed';

  const myTasks = useMemo(() => (user ? tasks.filter((t) => t.assigneeId === user.id) : []), [tasks, user]);
  const now = Date.now();
  const stats = {
    assigned: myTasks.length,
    completed: myTasks.filter((t) => t.status === completedKey).length,
    open: myTasks.filter((t) => t.status !== completedKey).length,
    overdue: myTasks.filter((t) => t.status !== completedKey && t.dueDate && new Date(t.dueDate).getTime() < now).length,
  };

  const isOverdue = (t: (typeof myTasks)[number]) =>
    t.status !== completedKey && !!t.dueDate && new Date(t.dueDate).getTime() < now;

  const shownTasks = useMemo(() => {
    const list = myTasks.filter((t) => {
      if (taskFilter === 'open') return t.status !== completedKey;
      if (taskFilter === 'completed') return t.status === completedKey;
      if (taskFilter === 'overdue') return isOverdue(t);
      return true;
    });
    return [...list].sort((a, b) => {
      const ac = a.status === completedKey ? 1 : 0;
      const bc = b.status === completedKey ? 1 : 0;
      if (ac !== bc) return ac - bc; // open tasks first
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd; // soonest due first
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTasks, taskFilter]);

  const myActivity = useMemo(
    () => (user ? taskActivity.filter((e) => e.actor?.id === user.id).slice(0, 12) : []),
    [taskActivity, user],
  );

  const statusLabel = (k: string) => taskStatuses.find((s) => s.key === k)?.label ?? k;
  const projectName = (id: string | null) => (id ? (projects.find((p) => p.id === id)?.name ?? 'a project') : 'No project');
  const memberName = (id: string) => members.find((m) => m.userId === id)?.user?.fullName ?? 'another member';

  if (!user) {
    return <div className="p-6 text-sm text-text-secondary">Not signed in.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <p className="text-xs text-text-secondary">
          This page shows only your own details. Other members can't see it, and you can't view theirs here.
        </p>

        {/* Identity */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-full ${colorFor(user.id)} flex items-center justify-center text-xl font-bold text-white shrink-0`}>
              {initialsOf(user.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-text-primary truncate">{user.fullName}</h1>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${isOwner ? 'bg-accent-purple/10 text-accent-purple' : 'bg-black/[0.05] text-text-secondary'}`}>
                  {isOwner ? 'Owner' : 'Member'}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-0.5">in {workspace?.name ?? 'this workspace'}</p>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail size={14} className="text-text-disabled shrink-0" />
                  <dd className="text-text-primary truncate">{user.email}</dd>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={14} className="text-text-disabled shrink-0" />
                  <dd className="text-text-primary truncate">{user.company || <span className="text-text-disabled">No company</span>}</dd>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarDays size={14} className="text-text-disabled shrink-0" />
                  <dd className="text-text-primary">Joined this workspace {longDate(me?.joinedAt)}</dd>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <UserIcon size={14} className="text-text-disabled shrink-0" />
                  <dd className="text-text-primary">Account created {longDate(user.createdAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Access */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={15} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Your access</h2>
          </div>
          {isOwner ? (
            <p className="text-sm text-text-secondary">As the workspace owner you have full control over everything in this workspace.</p>
          ) : (
            <ul className="space-y-2">
              {PERMISSION_META.map((p) => {
                const on = Boolean(me?.effectivePermissions[p.key]);
                return (
                  <li key={p.key} className="flex items-start gap-2.5">
                    <span className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center shrink-0 ${on ? 'bg-accent-green/15 text-accent-green' : 'bg-black/[0.05] text-text-disabled'}`}>
                      {on ? <Check size={11} /> : <Minus size={11} />}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm ${on ? 'text-text-primary' : 'text-text-secondary'}`}>{p.label}</p>
                      {!on && <p className="text-[11px] text-text-disabled">Ask the workspace owner to grant it.</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Task stats + breakdown */}
        <section>
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">Your tasks</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {([
              { key: 'all', label: 'Assigned to you', value: stats.assigned, icon: ListChecks, tone: 'text-text-primary' },
              { key: 'completed', label: 'Completed', value: stats.completed, icon: CircleCheck, tone: 'text-accent-green' },
              { key: 'open', label: 'Open', value: stats.open, icon: CircleDot, tone: 'text-accent-blue' },
              { key: 'overdue', label: 'Overdue', value: stats.overdue, icon: AlertTriangle, tone: 'text-accent-red' },
            ] as { key: TaskFilter; label: string; value: number; icon: typeof ListChecks; tone: string }[]).map((s) => (
              <button
                key={s.key}
                onClick={() => setTaskFilter(s.key)}
                aria-pressed={taskFilter === s.key}
                className={`bg-surface border rounded-xl p-4 text-left transition-colors ${
                  taskFilter === s.key ? 'border-accent-purple ring-1 ring-accent-purple/30' : 'border-border hover:border-accent-purple/40'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <s.icon size={12} className="text-text-disabled" />
                  <span className="text-xs font-medium text-text-secondary">{s.label}</span>
                </div>
                <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <span className="text-xs font-medium text-text-secondary">
                {taskFilter === 'all' ? 'All tasks assigned to you' :
                 taskFilter === 'open' ? 'Your open tasks' :
                 taskFilter === 'completed' ? 'Tasks you’ve completed' : 'Your overdue tasks'}
              </span>
              <span className="text-[11px] text-text-disabled tabular-nums">{shownTasks.length}</span>
            </div>
            {shownTasks.length === 0 ? (
              <p className="px-4 py-6 text-sm text-text-secondary text-center">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-border">
                {shownTasks.map((t) => {
                  const overdue = isOverdue(t);
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => setSelectedTaskId(t.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors"
                      >
                        <span className={`text-sm truncate flex-1 min-w-0 ${t.status === completedKey ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                          {t.name}
                        </span>
                        <span className="hidden sm:block text-[11px] text-text-secondary truncate max-w-[9rem] shrink-0">
                          {projectName(t.projectId)}
                        </span>
                        {t.dueDate && (
                          <span className={`text-[11px] shrink-0 tabular-nums ${overdue ? 'text-accent-red font-medium' : 'text-text-secondary'}`}>
                            {shortDate(t.dueDate)}
                          </span>
                        )}
                        <StatusPill statuses={taskStatuses} status={t.status} size="sm" />
                        <ChevronRight size={14} className="text-text-disabled shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">Your recent activity</h2>
          {myActivity.length === 0 ? (
            <p className="text-sm text-text-secondary bg-surface border border-border rounded-xl px-4 py-6 text-center">
              You haven't made any changes yet.
            </p>
          ) : (
            <div className="bg-surface border border-border rounded-xl divide-y divide-border">
              {myActivity.map((e) => (
                <div key={e.id} className="px-4 py-3">
                  <p className="text-sm text-text-primary leading-snug">
                    <span className="text-text-secondary">You {describeTaskActivity(e, statusLabel, projectName, memberName)}</span>{' '}
                    <span className="font-medium">“{e.taskName}”</span>
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    {projectName(e.projectId)} · {dateTime(e.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
