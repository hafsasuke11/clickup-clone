import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Trash2, Lock, Calendar, User as UserIcon, FolderKanban, AlignLeft,
  Paperclip, Download, X, Send, History, ListChecks, Circle, CheckCircle2, Plus,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useTaskThreadStore } from '@/store/taskThreadStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { useCan } from '@/utils/permissions';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import { describeTaskActivity } from '@/utils/activityText';
import { StatusSelect, StatusPill, resolveStatus } from './TaskStatusPill';
import { taskProgress, type TaskPriority } from '@/utils/types';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtBytes(n: number): string {
  if (!n) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(k)));
  return `${(n / k ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const fieldCls =
  'bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors';

function Avatar({ id, name, size = 24 }: { id: string; name: string; size?: number }) {
  return (
    <span
      className={`rounded-full ${colorFor(id)} flex items-center justify-center font-bold text-white shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {initialsOf(name || '?')}
    </span>
  );
}

export default function TaskDetailInline({ taskId, onBack }: { taskId: string; onBack?: () => void }) {
  const {
    tasks, projects, updateTask, deleteTask,
    addSubtask, updateSubtask, deleteSubtask,
  } = useTaskStore();
  const taskActivity = useTaskStore((s) => s.taskActivity);
  const taskActivityLoaded = useTaskStore((s) => s.taskActivityLoaded);
  const fetchTaskActivity = useTaskStore((s) => s.fetchTaskActivity);
  const { workspace, members } = useWorkspaceStore();
  const taskStatuses = useTaskStatuses();
  const user = useAuthStore((s) => s.user);
  const canEdit = useCan('manageTasks');
  const canAssign = useCan('assignTasks');
  const canDelete = useCan('deleteItems');

  const thread = useTaskThreadStore((s) => s.byTask[taskId]);
  const { fetchThread, addComment, deleteComment, uploadAttachment, downloadAttachment, deleteAttachment } =
    useTaskThreadStore();

  const task = tasks.find((t) => t.id === taskId);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [comment, setComment] = useState('');
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) { setName(task.name); setDesc(task.description); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, task?.name, task?.description]);

  useEffect(() => {
    if (workspace) void fetchThread(workspace.id, taskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, taskId, fetchThread]);

  useEffect(() => {
    if (workspace && !taskActivityLoaded) void fetchTaskActivity(workspace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, taskActivityLoaded, fetchTaskActivity]);

  const statusLabel = useMemo(() => {
    const map = new Map(taskStatuses.map((s) => [s.key, s.label]));
    return (key: string) => map.get(key) ?? key;
  }, [taskStatuses]);
  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? map.get(id) ?? 'a project' : 'No project');
  }, [projects]);
  const memberName = useMemo(() => {
    const map = new Map(members.map((m) => [m.userId, m.user?.fullName ?? 'Someone']));
    return (id: string) => map.get(id) ?? 'Someone';
  }, [members]);

  const activity = useMemo(
    () => taskActivity.filter((e) => e.taskId === taskId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [taskActivity, taskId],
  );

  if (!workspace) return null;

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
        <p className="text-sm text-text-secondary">This task is no longer available.</p>
        {onBack && (
          <button onClick={onBack} className="text-sm text-accent-purple hover:underline">Back to list</button>
        )}
      </div>
    );
  }

  const save = (patch: Record<string, unknown>) => updateTask(workspace.id, task.id, patch);
  const dueValue = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
  const assignee = members.find((m) => m.userId === task.assigneeId);
  const comments = thread?.comments ?? [];
  const attachments = thread?.attachments ?? [];
  const subtasks = [...(task.subtasks ?? [])].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  const progress = taskProgress(task);
  const lastActivity = activity[0];
  const createdOn = new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleDelete = () => {
    void deleteTask(workspace.id, task.id);
    onBack?.();
  };

  const submitComment = () => {
    const text = comment.trim();
    if (!text) return;
    void addComment(workspace.id, task.id, text);
    setComment('');
  };

  const submitSubtask = () => {
    const text = subtaskDraft.trim();
    if (!text) return;
    void addSubtask(workspace.id, task.id, text);
    setSubtaskDraft('');
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
        {onBack && (
          <button onClick={onBack} className="lg:hidden p-1.5 -ml-1.5 text-text-secondary hover:text-text-primary rounded-lg hover:bg-black/[0.03]">
            <ArrowLeft size={16} />
          </button>
        )}
        <span className="text-xs text-text-secondary bg-background border border-border px-2 py-0.5 rounded-full">Task</span>
        <div className="ml-auto flex items-center gap-1">
          {canDelete && (
            <button onClick={handleDelete} className="p-1.5 text-text-secondary hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors" title="Delete task">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {!canEdit && (
          <p className="flex items-center gap-1.5 text-[11px] text-text-secondary bg-black/[0.03] rounded-lg px-2.5 py-1.5">
            <Lock size={11} /> Read-only — you can comment, but not edit this task. Ask the workspace owner for edit access.
          </p>
        )}

        {/* Title */}
        {canEdit ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== task.name && save({ name: name.trim() })}
            className="w-full text-xl font-semibold text-text-primary bg-transparent border-b border-transparent focus:border-accent-purple/50 focus:outline-none pb-1 transition-colors"
            placeholder="Task name"
          />
        ) : (
          <h1 className="text-xl font-semibold text-text-primary break-words">{task.name}</h1>
        )}

        {/* Status + priority */}
        <div className="flex flex-wrap items-center gap-2">
          {canEdit
            ? <StatusSelect statuses={taskStatuses} status={task.status} onChange={(s) => save({ status: s })} />
            : <StatusPill statuses={taskStatuses} status={task.status} />}
          {canEdit ? (
            <select value={task.priority} onChange={(e) => save({ priority: e.target.value as TaskPriority })} className={`${fieldCls} capitalize`}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            <span className="text-xs px-2 py-1 rounded-lg border border-border capitalize text-text-secondary">{task.priority}</span>
          )}
        </div>

        {/* Assigned To */}
        <div className="flex items-start gap-3">
          <UserIcon size={15} className="text-text-secondary shrink-0 mt-1.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-secondary mb-1">Assigned To</p>
            <div className="flex items-center gap-2">
              {assignee?.user
                ? <Avatar id={assignee.userId} name={assignee.user.fullName} size={22} />
                : <span className="w-[22px] h-[22px] rounded-full bg-black/[0.06] flex items-center justify-center"><UserIcon size={12} className="text-text-disabled" /></span>}
              {canAssign ? (
                <select
                  value={task.assigneeId ?? ''}
                  onChange={(e) => save({ assigneeId: e.target.value || null })}
                  className={fieldCls}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.userId} value={m.userId}>{m.user?.fullName ?? 'Unknown'}</option>)}
                </select>
              ) : (
                <span className="text-sm text-text-primary">{assignee?.user?.fullName ?? 'Unassigned'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Due date */}
        <div className="flex items-start gap-3">
          <Calendar size={15} className="text-text-secondary shrink-0 mt-1.5" />
          <div className="flex-1">
            <p className="text-xs text-text-secondary mb-1">Due Date</p>
            {canEdit ? (
              <input type="date" value={dueValue} onChange={(e) => save({ dueDate: e.target.value || null })} className={fieldCls} />
            ) : (
              <p className="text-sm text-text-primary">{dueValue || <span className="text-text-disabled">None</span>}</p>
            )}
          </div>
        </div>

        {/* Add to project */}
        <div className="flex items-start gap-3">
          <FolderKanban size={15} className="text-text-secondary shrink-0 mt-1.5" />
          <div className="flex-1">
            <p className="text-xs text-text-secondary mb-1">Add to Project</p>
            {canEdit ? (
              <select value={task.projectId ?? ''} onChange={(e) => save({ projectId: e.target.value || null })} className={fieldCls}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <p className="text-sm text-text-primary">{projectName(task.projectId)}</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlignLeft size={15} className="text-text-secondary" />
            <p className="text-xs text-text-secondary">Description</p>
          </div>
          {canEdit ? (
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => desc !== task.description && save({ description: desc })}
              rows={4}
              placeholder="Add a description…"
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple transition-colors resize-none"
            />
          ) : (
            <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
              {task.description || <span className="text-text-disabled">No description</span>}
            </p>
          )}
        </div>

        {/* Progress & Subtasks */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2.5">
            <ListChecks size={15} className="text-text-secondary" />
            <p className="text-xs text-text-secondary">Progress &amp; Subtasks</p>
            {progress && <span className="text-[11px] text-text-disabled">{progress.done}/{progress.total}</span>}
          </div>

          {progress ? (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="font-semibold text-text-primary">{progress.pct}%</span>
                <span className="text-text-secondary">{progress.done} of {progress.total} subtasks completed</span>
              </div>
              <div className="h-2 rounded-full bg-black/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-green transition-all"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-text-disabled mb-3">No subtasks yet — add items below to track progress.</p>
          )}

          <div className="text-[11px] text-text-secondary space-y-0.5 mb-3">
            <p>Status: <span className="text-text-primary">{resolveStatus(taskStatuses, task.status).label}</span> · Created {createdOn}</p>
            {lastActivity && (
              <p className="truncate">
                Last activity: {lastActivity.actor?.id === user?.id ? 'You' : (lastActivity.actor?.fullName ?? 'Someone')}{' '}
                {describeTaskActivity(lastActivity, statusLabel, projectName, memberName)} · {timeAgo(lastActivity.createdAt)}
              </p>
            )}
          </div>

          {subtasks.length > 0 && (
            <ul className="space-y-1 mb-2">
              {subtasks.map((st) => (
                <li key={st.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => canEdit && void updateSubtask(workspace.id, task.id, st.id, { done: !st.done })}
                    className={`shrink-0 ${canEdit ? 'cursor-pointer' : 'cursor-default'} ${st.done ? 'text-accent-green' : 'text-text-disabled hover:text-accent-purple'}`}
                    title={st.done ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {st.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </button>
                  <span className={`text-sm flex-1 min-w-0 break-words ${st.done ? 'line-through text-text-disabled' : 'text-text-primary'}`}>
                    {st.title}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => void deleteSubtask(workspace.id, task.id, st.id)}
                      className="p-1 text-text-disabled hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Delete subtask"
                    >
                      <X size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <div className="flex items-center gap-2">
              <input
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitSubtask(); } }}
                placeholder="Add a subtask…"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple transition-colors"
              />
              <button
                onClick={submitSubtask}
                disabled={!subtaskDraft.trim()}
                className="p-2 bg-accent-purple text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40"
                title="Add subtask"
              >
                <Plus size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Attachments */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Paperclip size={15} className="text-text-secondary" />
            <p className="text-xs text-text-secondary">Attachments</p>
            <span className="text-[11px] text-text-disabled">{attachments.length}</span>
            {canEdit && (
              <button
                onClick={() => fileRef.current?.click()}
                className="ml-auto text-[12px] font-medium text-accent-purple hover:underline"
              >
                Attach file
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && workspace) void uploadAttachment(workspace.id, task.id, f);
                e.target.value = '';
              }}
            />
          </div>
          {attachments.length === 0 ? (
            <p className="text-[12px] text-text-disabled">No files attached.</p>
          ) : (
            <ul className="space-y-1.5">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
                  <Paperclip size={13} className="text-text-disabled shrink-0" />
                  <span className="text-sm text-text-primary truncate flex-1 min-w-0">{a.name}</span>
                  <span className="text-[11px] text-text-disabled shrink-0">{fmtBytes(a.size)}</span>
                  <button
                    onClick={() => workspace && void downloadAttachment(workspace.id, task.id, a.id)}
                    className="p-1 text-text-secondary hover:text-accent-purple transition-colors shrink-0"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                  {(canDelete || a.uploadedBy === user?.id) && (
                    <button
                      onClick={() => workspace && void deleteAttachment(workspace.id, task.id, a.id)}
                      className="p-1 text-text-secondary hover:text-accent-red transition-colors shrink-0"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activity */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2.5">
            <History size={15} className="text-text-secondary" />
            <p className="text-xs text-text-secondary">Activity</p>
          </div>
          {activity.length === 0 ? (
            <p className="text-[12px] text-text-disabled">No activity yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5">
                  <Avatar id={e.actor?.id ?? 'x'} name={e.actor?.fullName ?? '?'} size={22} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-text-primary leading-snug">
                      <span className="font-medium">{e.actor?.id === user?.id ? 'You' : (e.actor?.fullName ?? 'Someone')}</span>{' '}
                      <span className="text-text-secondary">{describeTaskActivity(e, statusLabel, projectName, memberName)}</span>
                    </p>
                    <p className="text-[10px] text-text-disabled mt-0.5">{timeAgo(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Comments */}
        <div className="border-t border-border pt-4">
          <p className="text-xs text-text-secondary mb-2.5">Comments <span className="text-text-disabled">{comments.length}</span></p>
          <ul className="space-y-3 mb-3">
            {comments.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 group">
                <Avatar id={c.authorId} name={c.author?.fullName ?? '?'} size={24} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-text-secondary">
                    <span className="font-medium text-text-primary">{c.author?.id === user?.id ? 'You' : (c.author?.fullName ?? 'Someone')}</span>
                    {' · '}{timeAgo(c.createdAt)}
                  </p>
                  <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{c.body}</p>
                </div>
                {(c.authorId === user?.id || canDelete) && (
                  <button
                    onClick={() => workspace && void deleteComment(workspace.id, task.id, c.id)}
                    className="p-1 text-text-disabled hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Delete comment"
                  >
                    <X size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); }
              }}
              rows={2}
              placeholder="Write a comment…  (⌘/Ctrl + Enter to send)"
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple transition-colors resize-none"
            />
            <button
              onClick={submitComment}
              disabled={!comment.trim()}
              className="p-2.5 bg-accent-purple text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-40"
              title="Send comment"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
