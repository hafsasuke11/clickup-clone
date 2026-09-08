import { useEffect, useMemo, useState } from 'react';
import { User as UserIcon, Mail, Building2, CalendarDays, ShieldCheck, Check, Minus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { DonutChart, type Slice } from '@/components/StatCharts';
import CategoryDetailModal from '@/components/CategoryDetailModal';
import ActivityFeed from '@/components/ActivityFeed';
import TwoFactorPanel from '@/components/TwoFactorPanel';
import { PERMISSION_META, useMyMembership } from '@/utils/permissions';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Task } from '@/utils/types';

const COMPLETED = 'completed';

type Bucket = 'completed' | 'in_progress' | 'pending' | 'overdue';
// No explicit colours — DonutChart falls back to the same mono-purple ramp the
// Dashboard's "Tasks by status" chart uses.
const BUCKET_META: { key: Bucket; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'pending', label: 'Pending' },
  { key: 'overdue', label: 'Due / Overdue' },
];

const longDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const me = useMyMembership();
  const { workspace, members } = useWorkspaceStore();
  const { tasks, projects, taskActivity, taskActivityLoaded, fetchTaskActivity } = useTaskStore();
  const taskStatuses = useTaskStatuses();
  const { setSelectedTaskId } = useUiStore();
  const [detail, setDetail] = useState<{ title: string; tasks: Task[] } | null>(null);

  useEffect(() => {
    if (workspace && !taskActivityLoaded) void fetchTaskActivity(workspace.id);
  }, [workspace, taskActivityLoaded, fetchTaskActivity]);

  const isOwner = me?.role === 'owner';
  const now = Date.now();

  const myTasks = useMemo(() => (user ? tasks.filter((t) => t.assigneeId === user.id) : []), [tasks, user]);

  const bucketOf = (t: Task): Bucket => {
    if (t.status === COMPLETED) return 'completed';
    if (t.dueDate && new Date(t.dueDate).getTime() < now) return 'overdue';
    if (t.status === 'in_progress') return 'in_progress';
    return 'pending';
  };

  const bucketCounts: Record<Bucket, number> = { completed: 0, in_progress: 0, pending: 0, overdue: 0 };
  for (const t of myTasks) bucketCounts[bucketOf(t)] += 1;

  const slices: Slice[] = BUCKET_META
    .map((b) => ({ key: b.key, label: b.label, value: bucketCounts[b.key] }))
    .filter((s) => s.value > 0);

  const openBucketDetail = (slice: Slice) => {
    const key = slice.key as Bucket;
    setDetail({ title: `${slice.label} — your tasks`, tasks: myTasks.filter((t) => bucketOf(t) === key) });
  };

  const myActivity = useMemo(
    () => (user ? taskActivity.filter((e) => e.actor?.id === user.id) : []),
    [taskActivity, user],
  );
  const liveTaskIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);

  const projectName = (id: string | null) => (id ? (projects.find((p) => p.id === id)?.name ?? 'a project') : 'No project');
  const statusLabel = (k: string) => taskStatuses.find((s) => s.key === k)?.label ?? k;
  const memberName = (id: string) => members.find((m) => m.userId === id)?.user?.fullName ?? 'another member';

  if (!user) return <div className="p-6 text-sm text-text-secondary">Not signed in.</div>;

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

        {/* Security */}
        <TwoFactorPanel />

        {/* Task distribution */}
        <section>
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">Your tasks</h2>
          <div className="bg-surface border border-border rounded-xl p-5">
            {myTasks.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-6">No tasks are assigned to you yet.</p>
            ) : (
              <DonutChart
                data={slices}
                centerLabel="assigned"
                onSelect={openBucketDetail}
                hint="Click a category to see those tasks"
              />
            )}
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Your recent activity</h2>
            <span className="text-[11px] text-text-disabled">Right-click an activity to delete it</span>
          </div>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {!taskActivityLoaded ? (
              <p className="text-sm text-text-secondary px-4 py-8 text-center">Loading activity…</p>
            ) : (
              <ActivityFeed
                entries={myActivity}
                workspaceId={workspace?.id ?? ''}
                selfActorId={user.id}
                paginated
                pageSize={10}
                onOpenTask={setSelectedTaskId}
                liveTaskIds={liveTaskIds}
                statusLabel={statusLabel}
                projectName={projectName}
                memberName={memberName}
                emptyText="You haven't made any changes yet."
              />
            )}
          </div>
        </section>
      </div>

      {detail && (
        <CategoryDetailModal
          title={detail.title}
          tasks={detail.tasks}
          totalTasks={myTasks.length}
          onClose={() => setDetail(null)}
          onOpenTask={setSelectedTaskId}
          backLabel="Back to profile"
        />
      )}
    </div>
  );
}
