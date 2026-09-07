import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { describeTaskActivity, activityBucket, type ActivityBucket } from '@/utils/activityText';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const BUCKETS: { key: ActivityBucket; label: string; cls: string }[] = [
  { key: 'added', label: 'Added', cls: 'text-accent-blue' },
  { key: 'updated', label: 'Updated', cls: 'text-accent-purple' },
  { key: 'completed', label: 'Completed', cls: 'text-accent-green' },
  { key: 'deleted', label: 'Deleted', cls: 'text-accent-red' },
];

const selectCls =
  'bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-purple transition-colors';

export default function ActivityPage() {
  const { workspace, members } = useWorkspaceStore();
  const { taskActivity, taskActivityLoaded, fetchTaskActivity, projects } = useTaskStore();
  const taskStatuses = useTaskStatuses();
  const [projectFilter, setProjectFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (workspace) void fetchTaskActivity(workspace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const statusLabel = (k: string) => taskStatuses.find((s) => s.key === k)?.label ?? k;
  const projectName = (id: string | null) =>
    id ? (projects.find((p) => p.id === id)?.name ?? 'a project') : 'No project';
  const memberName = (id?: string) => members.find((m) => m.userId === id)?.user?.fullName ?? 'Someone';

  // The project filter narrows both the summary and the feed; the member filter
  // narrows only the feed, so every contributor still shows in the summary.
  const byProject = useMemo(
    () =>
      taskActivity.filter((e) => {
        if (projectFilter === 'all') return true;
        if (projectFilter === 'none') return e.projectId === null;
        return e.projectId === projectFilter;
      }),
    [taskActivity, projectFilter],
  );
  const feed = useMemo(
    () => byProject.filter((e) => memberFilter === 'all' || e.actor?.id === memberFilter),
    [byProject, memberFilter],
  );

  const summary = useMemo(() => {
    return members
      .map((m) => {
        const mine = byProject.filter((e) => e.actor?.id === m.userId);
        const counts: Record<ActivityBucket, number> = { added: 0, updated: 0, completed: 0, deleted: 0 };
        mine.forEach((e) => { counts[activityBucket(e.action)] += 1; });
        return { member: m, counts, total: mine.length };
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [members, byProject]);

  const refresh = async () => {
    if (!workspace) return;
    setRefreshing(true);
    await fetchTaskActivity(workspace.id);
    setRefreshing(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <div className="ml-auto flex items-center gap-1.5">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={selectCls}>
            <option value="all">All projects</option>
            <option value="none">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} className={selectCls}>
            <option value="all">All members</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.user?.fullName ?? 'Unknown'}</option>
            ))}
          </select>
          <button
            onClick={() => void refresh()}
            className="p-1.5 rounded-lg border border-border bg-background text-text-secondary hover:text-text-primary transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!taskActivityLoaded ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="w-full space-y-6">
            {/* By member */}
            <section>
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">By member</h2>
              {summary.length === 0 ? (
                <p className="text-sm text-text-secondary bg-surface border border-border rounded-xl px-4 py-6 text-center">
                  No task activity yet{projectFilter !== 'all' ? ' for this project' : ''}.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.map(({ member, counts, total }) => (
                    <div key={member.userId} className="bg-surface border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={`w-8 h-8 rounded-full ${colorFor(member.userId)} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}>
                          {member.user ? initialsOf(member.user.fullName) : '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{member.user?.fullName ?? 'Unknown'}</p>
                          <p className="text-[11px] text-text-secondary tabular-nums">{total} action{total === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center">
                        {BUCKETS.map((b) => (
                          <div key={b.key}>
                            <p className={`text-base font-semibold tabular-nums ${counts[b.key] ? b.cls : 'text-text-disabled'}`}>{counts[b.key]}</p>
                            <p className="text-[10px] text-text-secondary">{b.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Feed */}
            <section>
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">
                {memberFilter === 'all' ? 'All activity' : `${memberName(memberFilter)}'s activity`}
              </h2>
              {feed.length === 0 ? (
                <p className="text-sm text-text-secondary bg-surface border border-border rounded-xl px-4 py-6 text-center">Nothing to show.</p>
              ) : (
                <div className="bg-surface border border-border rounded-xl divide-y divide-border">
                  {feed.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                      <div className={`w-6 h-6 mt-0.5 rounded-full ${colorFor(e.actor?.id ?? 'x')} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                        {e.actor ? initialsOf(e.actor.fullName) : '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary leading-snug">
                          <span className="font-medium">{e.actor?.fullName ?? 'Someone'}</span>{' '}
                          <span className="text-text-secondary">{describeTaskActivity(e, statusLabel, projectName, memberName)}</span>{' '}
                          <span className="font-medium">“{e.taskName}”</span>
                        </p>
                        <p className="text-[11px] text-text-secondary mt-0.5">
                          {projectName(e.projectId)} · {timeAgo(e.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
