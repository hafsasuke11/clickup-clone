import { useEffect, useState } from 'react';
import {
  Eye, Pencil, Copy, ListChecks, Flag, Trash2, ChevronRight, ChevronLeft, Check,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useProjectStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { useCan } from '@/utils/permissions';
import { StatusDot } from './TaskStatusPill';
import ConfirmDialog from './ConfirmDialog';
import type { Project, ProjectPriority } from '@/utils/types';

const MENU_W = 226;

type Pane = 'root' | 'status' | 'priority';

const PRIORITIES: { key: ProjectPriority; label: string }[] = [
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'normal', label: 'Normal' },
  { key: 'low', label: 'Low' },
];

interface Props {
  project: Project;
  /** Viewport coordinates to anchor the menu to (mouse point). */
  x: number;
  y: number;
  onClose: () => void;
  /** Opens the project detail drawer. */
  onView: () => void;
  /** Opens the edit-project modal. */
  onEdit: () => void;
}

const itemCls =
  'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-text-primary hover:bg-black/[0.04] transition-colors';
const iconCls = 'shrink-0 text-text-secondary';

/**
 * The project actions menu opened by right-clicking a project on the Projects
 * page. Mirrors {@link TaskContextMenu}: one small popover with drill-in panes
 * for status and priority.
 */
export default function ProjectContextMenu({ project, x, y, onClose, onView, onEdit }: Props) {
  const { workspace } = useWorkspaceStore();
  const statuses = useProjectStatuses();
  const { updateProject, deleteProject, createProject } = useTaskStore();
  const addToast = useUiStore((s) => s.addToast);
  const canManage = useCan('manageProjects');
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

  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - 320));

  const run = (fn: () => void) => { fn(); onClose(); };
  const setStatus = (key: string) => run(() => void updateProject(workspace.id, project.id, { status: key }));
  const setPriority = (p: ProjectPriority) => run(() => void updateProject(workspace.id, project.id, { priority: p }));
  const duplicate = () =>
    run(() => {
      void createProject(workspace.id, {
        name: `${project.name} (copy)`,
        description: project.description,
        color: project.color,
        priority: project.priority,
        status: project.status,
        startDate: project.startDate,
        dueDate: project.dueDate,
      }).then((p) => { if (p) addToast(`Project "${p.name}" created`, 'success'); });
    });

  const removeProject = async () => {
    setDeleting(true);
    await deleteProject(workspace.id, project.id);
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
                <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-text-disabled truncate">{project.name}</p>
                <div className="mb-1 border-t border-border" />

                <button className={itemCls} onClick={() => run(onView)}>
                  <Eye size={15} className={iconCls} /> View
                </button>
                {canManage && (
                  <button className={itemCls} onClick={() => run(onEdit)}>
                    <Pencil size={15} className={iconCls} /> Edit
                  </button>
                )}
                {canManage && (
                  <button className={itemCls} onClick={duplicate}>
                    <Copy size={15} className={iconCls} /> Duplicate
                  </button>
                )}

                {canManage && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button className={itemCls} onClick={() => setPane('status')}>
                      <ListChecks size={15} className={iconCls} /> Change status
                      <ChevronRight size={14} className="ml-auto text-text-disabled" />
                    </button>
                    <button className={itemCls} onClick={() => setPane('priority')}>
                      <Flag size={15} className={iconCls} /> Change priority
                      <ChevronRight size={14} className="ml-auto text-text-disabled" />
                    </button>
                  </>
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
                      {project.status === s.key && <Check size={14} className="ml-auto text-accent-purple shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}

            {pane === 'priority' && (
              <>
                {backHeader('Change priority')}
                <div className="mb-1 border-t border-border" />
                {PRIORITIES.map((p) => (
                  <button key={p.key} className={itemCls} onClick={() => setPriority(p.key)}>
                    <Flag size={14} className={iconCls} />
                    <span className="truncate">{p.label}</span>
                    {project.priority === p.key && <Check size={14} className="ml-auto text-accent-purple shrink-0" />}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${project.name}"? Its tasks are kept but will no longer belong to any project.`}
          confirmLabel="Delete project"
          danger
          loading={deleting}
          onConfirm={() => void removeProject()}
          onCancel={() => { setConfirmDelete(false); onClose(); }}
        />
      )}
    </>
  );
}
