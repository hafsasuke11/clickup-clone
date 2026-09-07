import { useMemo, useState } from 'react';
import {
  Pencil, Trash2, Calendar, AlignLeft, CheckSquare, Users, Activity as ActivityIcon,
  RotateCw, ChevronRight, X,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses, useProjectStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { useCan } from '@/utils/permissions';
import { StatusSelect, StatusPill } from './TaskStatusPill';
import { ProjectPriorityBadge } from './ProjectBadges';
import ConfirmDialog from './ConfirmDialog';
import { describeTaskActivity } from '@/utils/activityText';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Project, TaskActivityEntry } from '@/utils/types';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };

export default function ProjectDetailView({
  projectId, onEdit, onDeleted, onClose,
}: {
  projectId: string;
  onEdit: (p: Project) => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const {
    projects, tasks, taskActivity, updateTask, updateProject, deleteProject,
    fetchTaskActivity, clearTaskActivity,
  } = useTaskStore();
  const { workspace, members } = useWorkspaceStore();
  const taskStatuses = useTaskStatuses();
  const projectStatuses = useProjectStatuses();
  const { setSelectedTaskId } = useUiStore();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const canManageProject = useCan('manageProjects');
  const canDelete = useCan('deleteItems');
  const canManageTasks = useCan('manageTasks');

  const project = projects.find((p) => p.id === projectId);
  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === projectId), [tasks, projectId]);
  const activity = useMemo(() => taskActivity.filter((e) => e.projectId === projectId), [taskActivity, projectId]);

  // People connected to the project: task assignees, plus anyone who has
  // actually done work on a task here (assigned to them or not).
  const involvedMembers = useMemo(() => {
    const ids = new Set<string>();
    for (const t of projectTasks) if (t.assigneeId) ids.add(t.assigneeId);
    for (const e of activity) if (e.actor?.id) ids.add(e.actor.id);
    return members
      .filter((m) => ids.has(m.userId))
      .map((m) => ({
        m,
        assigned: projectTasks.filter((t) => t.assigneeId === m.userId).length,
        contributions: activity.filter((e) => e.actor?.id === m.userId).length,
      }))
      .sort((a, b) => b.contributions - a.contributions || b.assigned - a.assigned);
  }, [members, projectTasks, activity]);

  // Activity grouped by the task it happened on — newest task first, newest
  // contribution first within each task.
  const activityByTask = useMemo(() => {
    const groups = new Map<string, { key: string; taskId: string | null; name: string; live: boolean; entries: TaskActivityEntry[] }>();
    for (const e of activity) {
      const key = e.taskId ?? `name:${e.taskName}`;
      let g = groups.get(key);
      if (!g) {
        const liveTask = e.taskId ? tasks.find((t) => t.id === e.taskId) : undefined;
        g = { key, taskId: e.taskId, name: liveTask?.name ?? e.taskName, live: Boolean(liveTask), entries: [] };
        groups.set(key, g);
      }
      g.entries.push(e);
    }
    return [...groups.values()].sort((a, b) => b.entries[0].createdAt.localeCompare(a.entries[0].createdAt));
  }, [activity, tasks]);

  if (!project || !workspace) return null;

  const total = projectTasks.length;
  const completed = projectTasks.filter((t) => t.status === 'completed').length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const now = Date.now();
  const overdue = projectTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'completed',
  ).length;

  const statusLabel = (k: string) => taskStatuses.find((s) => s.key === k)?.label ?? k;
  const memberName = (id: string) => members.find((m) => m.userId === id)?.user?.fullName ?? 'another member';
  const projectNameOf = (id: string | null) =>
    id ? (projects.find((p) => p.id === id)?.name ?? 'a project') : 'No project';

  // Opening a task closes the project drawer so the two panels don't stack.
  const openTask = (id: string) => { setSelectedTaskId(id); onClose(); };

  const removeProject = async () => {
    setDeleting(true);
    await deleteProject(workspace.id, projectId);
    setDeleting(false);
    setConfirmDelete(false);
    onDeleted();
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchTaskActivity(workspace.id);
    setRefreshing(false);
  };

  const sectionTitle = (icon: React.ReactNode, label: string, count?: number, right?: React.ReactNode) => (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-text-secondary">{icon}</span>
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{label}</h3>
      {count !== undefined && (
        <span className="text-[11px] text-text-secondary bg-black/[0.05] px-1.5 py-0.5 rounded-full tabular-nums">{count}</span>
      )}
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );

  return (
    <div className="px-5 py-5 space-y-6">
      {/* PROJECT */}
      <div>
        <div className="flex items-start gap-3">
          <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: project.color }} />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-text-primary break-words">{project.name}</h2>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {canManageProject
                ? <StatusSelect statuses={projectStatuses} status={project.status} onChange={(s) => updateProject(workspace.id, project.id, { status: s })} />
                : <StatusPill statuses={projectStatuses} status={project.status} />}
              <ProjectPriorityBadge priority={project.priority} />
              {(project.startDate || project.dueDate) && (
                <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Calendar size={13} />
                  {project.startDate ? fmt(project.startDate) : '—'} – {project.dueDate ? fmt(project.dueDate) : '—'}
                </span>
              )}
              {overdue > 0 && <span className="text-xs text-accent-red font-medium">{overdue} overdue</span>}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {canManageProject && (
              <button onClick={() => onEdit(project)} className="p-1.5 text-text-secondary hover:text-accent-purple hover:bg-black/[0.03] rounded-lg transition-colors" title="Edit project">
                <Pencil size={14} />
              </button>
            )}
            {canDelete && (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-text-secondary hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors" title="Delete project">
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-black/[0.03] rounded-lg transition-colors" title="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        {project.description ? (
          <p className="text-sm text-text-primary whitespace-pre-wrap break-words mt-3 flex items-start gap-2">
            <AlignLeft size={14} className="text-text-secondary shrink-0 mt-0.5" />
            <span>{project.description}</span>
          </p>
        ) : (
          <p className="text-sm text-text-disabled mt-3 flex items-center gap-2">
            <AlignLeft size={14} className="shrink-0" /> No description
          </p>
        )}
      </div>

      {/* TASKS */}
      <section>
        {sectionTitle(<CheckSquare size={14} />, 'Tasks', total)}
        <div className="border border-border rounded-xl overflow-hidden">
          {projectTasks.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-6 text-center">No tasks in this project yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {projectTasks.map((t) => {
                const assignee = members.find((m) => m.userId === t.assigneeId)?.user;
                return (
                  <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-black/[0.02] transition-colors">
                    <button
                      onClick={() => openTask(t.id)}
                      className={`text-sm text-left flex-1 min-w-0 truncate ${t.status === 'completed' ? 'line-through text-text-disabled' : 'text-text-primary hover:text-accent-purple'}`}
                    >
                      {t.name}
                    </button>
                    {t.dueDate && <span className="text-[11px] text-text-secondary shrink-0">{shortDate(t.dueDate)}</span>}
                    <span className="shrink-0 flex items-center gap-1 text-[11px] text-text-secondary" title={assignee ? assignee.fullName : 'Unassigned'}>
                      {assignee ? (
                        <span className={`w-5 h-5 rounded-full ${colorFor(t.assigneeId!)} flex items-center justify-center text-[9px] font-bold text-white`}>
                          {initialsOf(assignee.fullName)}
                        </span>
                      ) : (
                        <span className="text-text-disabled">Unassigned</span>
                      )}
                    </span>
                    <span className="shrink-0">
                      {canManageTasks
                        ? <StatusSelect statuses={taskStatuses} status={t.status} size="sm" onChange={(s) => updateTask(workspace.id, t.id, { status: s })} />
                        : <StatusPill statuses={taskStatuses} status={t.status} size="sm" />}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* MEMBERS */}
      <section>
        {sectionTitle(<Users size={14} />, 'Members', involvedMembers.length)}
        <div className="border border-border rounded-xl overflow-hidden">
          {involvedMembers.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-6 text-center">No members are working on this project yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {involvedMembers.map(({ m, assigned, contributions }) => (
                <div key={m.userId} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-7 h-7 rounded-full ${colorFor(m.userId)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                    {m.user ? initialsOf(m.user.fullName) : '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{m.user?.fullName ?? 'Unknown'}</p>
                    <p className="text-[11px] text-text-secondary tabular-nums">
                      {assigned} task{assigned === 1 ? '' : 's'} · {contributions} contribution{contributions === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="text-[10px] text-text-disabled uppercase tracking-wide shrink-0">{ROLE_LABEL[m.role] ?? m.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ACTIVITIES / CONTRIBUTIONS — grouped by task */}
      <section>
        {sectionTitle(
          <ActivityIcon size={14} />, 'Activities', undefined,
          <span className="flex items-center gap-0.5">
            <button
              onClick={() => void refresh()}
              className="p-1 text-text-secondary hover:text-text-primary hover:bg-black/[0.04] rounded-md transition-colors"
              title="Refresh activities"
            >
              <RotateCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {canManageProject && (
              <button
                onClick={() => setConfirmClear(true)}
                disabled={activity.length === 0}
                className="p-1 text-text-secondary hover:text-accent-red hover:bg-accent-red/10 rounded-md transition-colors disabled:opacity-40"
                title="Clear activities"
              >
                <Trash2 size={13} />
              </button>
            )}
          </span>,
        )}
        <div className="border border-border rounded-xl overflow-hidden">
          {activityByTask.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-6 text-center">No contributions recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {activityByTask.map((g) => (
                <div key={g.key} className="px-4 py-3">
                  <button
                    onClick={() => g.taskId && g.live && openTask(g.taskId)}
                    disabled={!g.live}
                    className={`flex items-center gap-1 text-sm font-medium mb-2 ${g.live ? 'text-text-primary hover:text-accent-purple' : 'text-text-secondary cursor-default'}`}
                  >
                    {g.name}
                    {!g.live && <span className="text-[10px] text-text-disabled font-normal">(deleted)</span>}
                    {g.live && <ChevronRight size={13} className="text-text-disabled" />}
                  </button>
                  <ul className="space-y-1.5 pl-0.5">
                    {g.entries.map((e) => (
                      <li key={e.id} className="flex items-start gap-2.5">
                        <div className={`w-5 h-5 mt-0.5 rounded-full ${colorFor(e.actor?.id ?? 'x')} flex items-center justify-center text-[8px] font-bold text-white shrink-0`}>
                          {e.actor ? initialsOf(e.actor.fullName) : '?'}
                        </div>
                        <p className="text-xs text-text-primary leading-snug">
                          <span className="font-medium">{e.actor?.fullName ?? 'Someone'}</span>{' '}
                          <span className="text-text-secondary">{describeTaskActivity(e, statusLabel, projectNameOf, memberName)}</span>
                          <span className="text-text-disabled"> · {dateTime(e.createdAt)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* OVERALL PROGRESS */}
      <section>
        {sectionTitle(<CheckSquare size={14} />, 'Overall progress')}
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-text-primary">
            {total === 0
              ? <span className="text-text-secondary">Nothing to track yet</span>
              : <><b className="tabular-nums">{completed}</b> of <b className="tabular-nums">{total}</b> tasks complete</>}
          </span>
          {total > 0 && <span className="text-sm font-semibold text-text-primary tabular-nums">{pct}%</span>}
        </div>
        <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-accent-green transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <div className="text-xs text-text-secondary space-y-1 pt-2 border-t border-border">
        <p>Created {fmt(project.createdAt)}</p>
        {(() => {
          const creator = members.find((m) => m.userId === project.createdBy)?.user;
          return creator ? <p>Created by {creator.fullName}</p> : null;
        })()}
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear activities"
          message={`Remove all recorded activity for "${project.name}"? This can't be undone.`}
          confirmLabel="Clear activities"
          danger
          onConfirm={() => { void clearTaskActivity(workspace.id, projectId); setConfirmClear(false); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${project.name}"? Its tasks are kept but will no longer belong to any project.`}
          confirmLabel="Delete project"
          danger
          loading={deleting}
          onConfirm={() => void removeProject()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
