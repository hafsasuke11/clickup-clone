import { useState, useEffect } from 'react';
import { X, Trash2, Calendar, AlignLeft, Tag, User, ChevronDown } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import type { TaskPriority, TaskStatus } from '@/utils/types';
import { STATUS_META, TASK_STATUS_ORDER } from './TaskStatusPill';

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'normal', label: 'Normal', color: 'text-blue-600' },
  { value: 'low', label: 'Low', color: 'text-gray-500' },
];

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function StatusBadge({ status, onChange }: { status: TaskStatus; onChange: (s: TaskStatus) => void }) {
  const [open, setOpen] = useState(false);
  const cur = STATUS_META[status];
  const CurIcon = cur.icon;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all hover:brightness-95 ${cur.bg} ${cur.border} ${cur.text}`}>
        <CurIcon size={13} strokeWidth={2.5} />
        <span>{cur.label}</span>
        <ChevronDown size={13} className="opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-40 bg-surface border border-border rounded-xl shadow-xl z-50 py-1">
            {TASK_STATUS_ORDER.map((s) => {
              const meta = STATUS_META[s];
              const Icon = meta.icon;
              return (
                <button key={s} onClick={() => { onChange(s); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-black/[0.03] ${s === status ? meta.text : 'text-text-secondary hover:text-text-primary'}`}>
                  <Icon size={13} strokeWidth={2.5} className={meta.text} />{meta.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PriorityBadge({ priority, onChange }: { priority: TaskPriority; onChange: (p: TaskPriority) => void }) {
  const [open, setOpen] = useState(false);
  const cur = priorityOptions.find((o) => o.value === priority)!;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm hover:border-accent-purple/50 transition-colors">
        <Tag size={13} className={cur.color} />
        <span className="text-text-primary capitalize">{cur.label}</span>
        <ChevronDown size={13} className="text-text-secondary" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-32 bg-surface border border-border rounded-xl shadow-xl z-50 py-1">
            {priorityOptions.map((o) => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/[0.03] transition-colors">
                <Tag size={13} className={o.color} /><span className={`capitalize ${o.color}`}>{o.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AssigneeBadge({ assigneeId, onChange }: { assigneeId: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const { members } = useWorkspaceStore();
  const current = members.find((m) => m.userId === assigneeId);

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm hover:border-accent-purple/50 transition-colors">
        {current?.user ? (
          <div className="w-5 h-5 rounded-full bg-accent-purple flex items-center justify-center text-[9px] font-bold text-white">{initialsOf(current.user.fullName)}</div>
        ) : (
          <User size={13} className="text-text-secondary" />
        )}
        <span className="text-text-primary">{current?.user?.fullName ?? 'Unassigned'}</span>
        <ChevronDown size={13} className="text-text-secondary" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-48 bg-surface border border-border rounded-xl shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
            <button onClick={() => { onChange(null); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-black/[0.03] transition-colors">
              Unassigned
            </button>
            {members.map((m) => (
              <button key={m.userId} onClick={() => { onChange(m.userId); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-black/[0.03] transition-colors">
                <div className="w-5 h-5 rounded-full bg-accent-purple flex items-center justify-center text-[9px] font-bold text-white">{m.user ? initialsOf(m.user.fullName) : '?'}</div>
                {m.user?.fullName}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function TaskDetailPanel() {
  const { tasks, updateTask, deleteTask } = useTaskStore();
  const { workspace, members } = useWorkspaceStore();
  const { selectedTaskId, setSelectedTaskId } = useUiStore();
  const task = tasks.find((t) => t.id === selectedTaskId);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    if (task) { setName(task.name); setDesc(task.description); }
  }, [task]);

  if (!task || !workspace) return null;

  const save = (field: Record<string, unknown>) => updateTask(workspace.id, task.id, field);

  const handleDelete = () => {
    deleteTask(workspace.id, task.id);
    setSelectedTaskId(null);
  };

  const formattedDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
  const creator = members.find((m) => m.userId === task.createdBy);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedTaskId(null)} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-surface border-l border-border z-50 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <span className="text-xs text-text-secondary bg-background border border-border px-2 py-0.5 rounded-full">Task</span>
          <div className="flex items-center gap-1">
            <button onClick={handleDelete} className="p-1.5 text-text-secondary hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors" title="Delete task">
              <Trash2 size={15} />
            </button>
            <button onClick={() => setSelectedTaskId(null)} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-black/[0.03] rounded-lg transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && save({ name: name.trim() })}
            className="w-full text-lg font-semibold text-text-primary bg-transparent border-b border-transparent focus:border-accent-purple/50 focus:outline-none pb-1 transition-colors placeholder:text-text-secondary"
            placeholder="Task name"
          />

          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={task.status} onChange={(s) => save({ status: s })} />
            <PriorityBadge priority={task.priority} onChange={(p) => save({ priority: p })} />
          </div>

          <div className="flex items-center gap-3">
            <Calendar size={15} className="text-text-secondary shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-text-secondary mb-1">Due Date</p>
              <input
                type="date"
                value={formattedDate}
                onChange={(e) => save({ dueDate: e.target.value || null })}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <User size={15} className="text-text-secondary shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-text-secondary mb-1">Assignee</p>
              <AssigneeBadge assigneeId={task.assigneeId} onChange={(id) => save({ assigneeId: id })} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlignLeft size={15} className="text-text-secondary" />
              <p className="text-xs text-text-secondary">Description</p>
            </div>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => save({ description: desc })}
              rows={5}
              placeholder="Add a description..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple transition-colors resize-none"
            />
          </div>

          <div className="text-xs text-text-secondary space-y-1 pt-2 border-t border-border">
            <p>Created: {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            {creator?.user && <p>Created by: {creator.user.fullName}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
