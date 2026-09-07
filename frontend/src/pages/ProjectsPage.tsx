import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Filter, X, FolderKanban, ChevronRight, ChevronDown } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses, useProjectStatuses } from '@/store/workspaceStore';
import ProjectModal from '@/components/ProjectModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ManageStatusesButton } from '@/components/StatusManager';
import { PROJECT_PRIORITY_META, PROJECT_PRIORITY_ORDER, ProjectPriorityBadge } from '@/components/ProjectBadges';
import { StatusSelect, StatusDot } from '@/components/TaskStatusPill';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import type { Project, ProjectPriority, ProjectStatus, Task } from '@/utils/types';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function Popover({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1.5 w-52 bg-surface border border-border rounded-xl shadow-xl z-50 p-2">
        {children}
      </div>
    </>
  );
}

function CheckList<T extends string>({
  options, labels, selected, onToggle, onClear, label,
}: {
  options: T[];
  labels?: Record<string, string>;
  selected: T[];
  onToggle: (v: T) => void;
  onClear: () => void;
  label: string;
}) {
  return (
    <>
      <p className="px-2 py-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">{label}</p>
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.03] cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={selected.includes(o)}
            onChange={() => onToggle(o)}
            className="w-3.5 h-3.5 rounded border border-border bg-transparent accent-accent-purple"
          />
          <span className="text-xs text-text-primary capitalize">{labels?.[o] ?? o.replace('_', ' ')}</span>
        </label>
      ))}
      {selected.length > 0 && (
        <button onClick={onClear} className="w-full mt-1 px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary text-left border-t border-border flex items-center gap-1.5">
          <X size={11} /> Clear
        </button>
      )}
    </>
  );
}

export default function ProjectsPage() {
  const { projects, tasks, deleteProject, updateProject, updateTask } = useTaskStore();
  const { workspace, members } = useWorkspaceStore();
  const taskStatuses = useTaskStatuses();
  const projectStatuses = useProjectStatuses();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus[]>([]);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const now = Date.now();
  const projectStatusLabels = Object.fromEntries(projectStatuses.map((s) => [s.key, s.label]));

  // Group tasks by the project they're assigned to. Only these show inside a project —
  // the same task objects used on the List, Board and Calendar.
  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.projectId) continue;
      const arr = map.get(t.projectId) ?? [];
      arr.push(t);
      map.set(t.projectId, arr);
    }
    return map;
  }, [tasks]);

  const filteredProjects = useMemo(() => {
    return [...projects]
      .filter((p) => (priorityFilter.length ? priorityFilter.includes(p.priority) : true))
      .filter((p) => (statusFilter.length ? statusFilter.includes(p.status) : true))
      .sort((a, b) => PROJECT_PRIORITY_META[a.priority].rank - PROJECT_PRIORITY_META[b.priority].rank);
  }, [projects, priorityFilter, statusFilter]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: Project) => { setEditing(p); setModalOpen(true); };
  const toggleExpanded = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const confirmDelete = async () => {
    if (!deleteTarget || !workspace) return;
    setDeleting(true);
    await deleteProject(workspace.id, deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  const filterBtn = (active: number) =>
    `flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
      active ? 'bg-accent-purple/10 border-accent-purple/30 text-accent-purple' : 'bg-background border-border text-text-secondary hover:text-text-primary'
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1.5 px-4 py-2 border-b border-border shrink-0">
        <div className="relative">
          <button onClick={() => setPriorityOpen((v) => !v)} className={filterBtn(priorityFilter.length)}>
            <Filter size={13} /> Priority{priorityFilter.length ? ` (${priorityFilter.length})` : ''}
          </button>
          <Popover open={priorityOpen} onClose={() => setPriorityOpen(false)}>
            <CheckList
              label="Priority"
              options={PROJECT_PRIORITY_ORDER}
              selected={priorityFilter}
              onToggle={(v) => setPriorityFilter((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
              onClear={() => setPriorityFilter([])}
            />
          </Popover>
        </div>

        <div className="relative">
          <button onClick={() => setStatusOpen((v) => !v)} className={filterBtn(statusFilter.length)}>
            <Filter size={13} /> Status{statusFilter.length ? ` (${statusFilter.length})` : ''}
          </button>
          <Popover open={statusOpen} onClose={() => setStatusOpen(false)}>
            <CheckList
              label="Project status"
              options={projectStatuses.map((s) => s.key)}
              labels={projectStatusLabels}
              selected={statusFilter}
              onToggle={(v) => setStatusFilter((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
              onClear={() => setStatusFilter([])}
            />
          </Popover>
        </div>

        <ManageStatusesButton kind="project" />

        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors">
          <Plus size={13} /> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24">
          <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
            <FolderKanban size={28} className="text-accent-purple" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">No projects yet</h2>
          <p className="text-sm text-text-secondary">Create a project to group its tasks and track progress.</p>
          <button onClick={openCreate} className="px-4 py-2 bg-accent-purple text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
            New Project
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-6 px-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {filteredProjects.length === 0 ? (
              <p className="text-sm text-text-secondary py-16 text-center">No projects match the current filters.</p>
            ) : (
              filteredProjects.map((p) => {
                const pt = tasksByProject.get(p.id) ?? [];
                const total = pt.length;
                const completed = pt.filter((t) => t.status === 'completed').length;
                const remaining = total - completed;
                const overdue = pt.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'completed').length;
                const pct = total ? Math.round((completed / total) * 100) : 0;
                const isOpen = expanded.has(p.id);

                return (
                  <div
                    key={p.id}
                    className="bg-surface border border-border rounded-2xl overflow-hidden group"
                    style={{ borderLeft: `4px solid ${p.color}` }}
                  >
                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-text-primary truncate">{p.name}</h3>
                          {p.description && (
                            <p className="text-xs text-text-secondary mt-1 line-clamp-1">{p.description}</p>
                          )}
                        </div>
                        {workspace && (
                          <StatusSelect
                            statuses={projectStatuses}
                            status={p.status}
                            size="sm"
                            onChange={(s) => updateProject(workspace.id, p.id, { status: s })}
                          />
                        )}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-text-secondary hover:text-accent-purple hover:bg-black/[0.03] rounded-lg transition-colors" title="Edit project">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-text-secondary hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors" title="Delete project">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Progress — how much is done vs left */}
                      <div className="mt-4">
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-sm text-text-primary">
                            {total === 0 ? (
                              <span className="text-text-secondary">No tasks yet</span>
                            ) : (
                              <>
                                <b className="tabular-nums">{completed}</b> of <b className="tabular-nums">{total}</b> tasks done
                                <span className="text-text-secondary"> · {remaining} left</span>
                              </>
                            )}
                          </span>
                          {total > 0 && <span className="text-sm font-semibold text-text-primary tabular-nums">{pct}%</span>}
                        </div>
                        <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-accent-green transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        {total > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-text-secondary">
                            {taskStatuses.map((st) => {
                              const n = pt.filter((t) => t.status === st.key).length;
                              return n > 0 ? (
                                <span key={st.key} className="flex items-center gap-1">
                                  <StatusDot color={st.color} />{n} {st.label.toLowerCase()}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-[11px] text-text-secondary">
                        <ProjectPriorityBadge priority={p.priority} />
                        {(p.startDate || p.dueDate) && (
                          <>
                            <span className="text-text-disabled">·</span>
                            <span>{p.startDate ? fmt(p.startDate) : '—'} – {p.dueDate ? fmt(p.dueDate) : '—'}</span>
                          </>
                        )}
                        {overdue > 0 && (
                          <>
                            <span className="text-text-disabled">·</span>
                            <span className="text-accent-red font-medium">{overdue} overdue</span>
                          </>
                        )}
                      </div>

                      {/* Expand toggle */}
                      <div className="mt-3 pt-3 border-t border-border">
                        {total === 0 ? (
                          <p className="text-xs text-text-disabled">No tasks assigned to this project yet.</p>
                        ) : (
                          <button
                            onClick={() => toggleExpanded(p.id)}
                            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                          >
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {isOpen ? 'Hide' : 'Show'} {total} task{total === 1 ? '' : 's'} in this project
                          </button>
                        )}
                      </div>
                    </div>

                    {isOpen && total > 0 && (
                      <div className="border-t border-border bg-black/[0.015] divide-y divide-border">
                        {pt.map((t) => {
                          const assignee = members.find((m) => m.userId === t.assigneeId)?.user;
                          return (
                            <div key={t.id} className="flex items-start gap-3 px-5 py-2.5">
                              <span className={`text-sm flex-1 min-w-0 break-words ${t.status === 'completed' ? 'line-through text-text-disabled' : 'text-text-primary'}`}>
                                {t.name}
                              </span>
                              {t.dueDate && <span className="text-[11px] text-text-secondary shrink-0 mt-0.5">{shortDate(t.dueDate)}</span>}
                              {assignee && (
                                <div className={`w-5 h-5 rounded-full ${colorFor(t.assigneeId!)} flex items-center justify-center text-[9px] font-bold text-white shrink-0`} title={assignee.fullName}>
                                  {initialsOf(assignee.fullName)}
                                </div>
                              )}
                              {workspace && (
                                <span className="shrink-0">
                                  <StatusSelect
                                    statuses={taskStatuses}
                                    status={t.status}
                                    size="sm"
                                    onChange={(s) => updateTask(workspace.id, t.id, { status: s })}
                                  />
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {modalOpen && <ProjectModal project={editing} onClose={() => { setModalOpen(false); setEditing(null); }} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${deleteTarget.name}"? Its tasks are kept but will no longer belong to any project.`}
          confirmLabel="Delete project"
          danger
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
