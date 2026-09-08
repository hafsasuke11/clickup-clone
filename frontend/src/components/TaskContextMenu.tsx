import { useEffect, useState } from 'react';
import {
  Eye, Pencil, Copy, CheckCircle2, UserPlus, ArrowRightLeft, ListChecks, Trash2, ChevronRight, ChevronLeft, Check,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useCan } from '@/utils/permissions';
import { StatusDot } from './TaskStatusPill';
import ConfirmDialog from './ConfirmDialog';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Task } from '@/utils/types';

const MENU_W = 226;

type Pane = 'root' | 'status' | 'assignee';

interface Props {
  task: Task;
  /** Viewport coordinates to anchor the menu to (mouse point or button corner). */
  x: number;
  y: number;
  onClose: () => void;
  /** Opens the read-only quick view under the card. */
  onView: () => void;
  /** Opens the full editable task drawer. */
  onEdit: () => void;
}

const itemCls =
  'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-text-primary hover:bg-black/[0.04] transition-colors';
const iconCls = 'shrink-0 text-text-secondary';

/**
 * The task actions menu shared by the card's ⋯ button and right-click. Two
 * "drill-in" panes (status, assignee) keep everything inside one small popover
 * so it stays simple for first-time users.
 */
export default function TaskContextMenu({ task, x, y, onClose, onView, onEdit }: Props) {
  const { workspace, members } = useWorkspaceStore();
  const statuses = useTaskStatuses();
  const { updateTask, deleteTask, createTask } = useTaskStore();
  const canManage = useCan('manageTasks');
  const canAssign = useCan('assignTasks');
  const canDelete = useCan('deleteItems');

  const [pane, setPane] = useState<Pane>('root');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The menu is pinned to a viewport point, so close it if the page moves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onScroll = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  if (!workspace) return null;

  // Keep the popover fully on screen.
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - 360));

  const run = (fn: () => void) => { fn(); onClose(); };
  const setStatus = (key: string) => run(() => void updateTask(workspace.id, task.id, { status: key }));
  const markComplete = () => run(() => void updateTask(workspace.id, task.id, { status: 'completed' }));
  const setAssignee = (id: string | null) => run(() => void updateTask(workspace.id, task.id, { assigneeId: id }));
  const duplicate = () =>
    run(() => void createTask(
      workspace.id,
      {
        name: `${task.name} (copy)`,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assigneeId: task.assigneeId,
        projectId: task.projectId,
      },
      { force: true },
    ));

  const removeTask = async () => {
    setDeleting(true);
    await deleteTask(workspace.id, task.id);
    setDeleting(false);
    setConfirmDelete(false);
    onClose();
  };

  const backHeader = (label: string) => (
    <button
      className="w-full flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
      onClick={() => setPane('root')}
    >
      <ChevronLeft size={14} /> {label}
    </button>
  );

  return (
    <>
      {!confirmDelete && (
        <>
          {/* click-away and right-click-away */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={onClose}
            onContextMenu={(e) => { e.preventDefault(); onClose(); }}
          />
          <div
            role="menu"
            style={{ left, top, width: MENU_W }}
            className="fixed z-[61] bg-surface border border-border rounded-xl shadow-2xl py-1 overflow-hidden animate-slide-up"
          >
            {pane === 'root' && (
              <>
                <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-text-disabled truncate">{task.name}</p>
                <div className="mb-1 border-t border-border" />

                <button className={itemCls} onClick={() => run(onView)}>
                  <Eye size={15} className={iconCls} /> View
                </button>
                {canManage && (
                  <button className={itemCls} onClick={() => run(onEdit)}>
                    <Pencil size={15} className={iconCls} /> Edit
                  </button>
                )}
                {canManage && task.status !== 'completed' && (
                  <button className={itemCls} onClick={markComplete}>
                    <CheckCircle2 size={15} className={iconCls} /> Mark complete
                  </button>
                )}
                {canManage && (
                  <button className={itemCls} onClick={duplicate}>
                    <Copy size={15} className={iconCls} /> Duplicate
                  </button>
                )}

                {canAssign && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button className={itemCls} onClick={() => setPane('assignee')}>
                      <UserPlus size={15} className={iconCls} /> Assign
                      <ChevronRight size={14} className="ml-auto text-text-disabled" />
                    </button>
                    <button className={itemCls} onClick={() => setPane('assignee')}>
                      <ArrowRightLeft size={15} className={iconCls} /> Reassign
                      <ChevronRight size={14} className="ml-auto text-text-disabled" />
                    </button>
                  </>
                )}
                {canManage && (
                  <button className={itemCls} onClick={() => setPane('status')}>
                    <ListChecks size={15} className={iconCls} /> Change status
                    <ChevronRight size={14} className="ml-auto text-text-disabled" />
                  </button>
                )}

                {canDelete && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-accent-red hover:bg-accent-red/10 transition-colors"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={15} className="shrink-0" /> Delete
                    </button>
                  </>
                )}
              </>
            )}

            {pane === 'status' && (
              <>
                {backHeader('Change status')}
                <div className="mb-1 border-t border-border" />
                <div className="max-h-64 overflow-y-auto">
                  {statuses.map((s) => (
                    <button key={s.key} className={itemCls} onClick={() => setStatus(s.key)}>
                      <StatusDot color={s.color} />
                      <span className="truncate">{s.label}</span>
                      {task.status === s.key && <Check size={14} className="ml-auto text-accent-purple shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}

            {pane === 'assignee' && (
              <>
                {backHeader('Assign to')}
                <div className="mb-1 border-t border-border" />
                <div className="max-h-64 overflow-y-auto">
                  <button className={itemCls} onClick={() => setAssignee(null)}>
                    <span className="w-5 h-5 rounded-full border border-dashed border-border shrink-0" />
                    <span className="truncate text-text-secondary">Unassigned</span>
                    {!task.assigneeId && <Check size={14} className="ml-auto text-accent-purple shrink-0" />}
                  </button>
                  {members.map((m) => (
                    <button key={m.userId} className={itemCls} onClick={() => setAssignee(m.userId)}>
                      <span className={`w-5 h-5 rounded-full ${colorFor(m.userId)} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                        {m.user ? initialsOf(m.user.fullName) : '?'}
                      </span>
                      <span className="truncate">{m.user?.fullName ?? 'Unknown'}</span>
                      {task.assigneeId === m.userId && <Check size={14} className="ml-auto text-accent-purple shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete task"
          message={`Delete "${task.name}"? This can't be undone.`}
          confirmLabel="Delete task"
          danger
          loading={deleting}
          onConfirm={() => void removeTask()}
          onCancel={() => { setConfirmDelete(false); onClose(); }}
        />
      )}
    </>
  );
}
