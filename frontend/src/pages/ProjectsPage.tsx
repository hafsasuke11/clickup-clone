import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, GripVertical, ChevronRight, FolderKanban, List as ListIcon, LayoutGrid, CalendarRange, X,
} from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useProjectStatuses } from '@/store/workspaceStore';
import { useCan } from '@/utils/permissions';
import ProjectModal from '@/components/ProjectModal';
import ProjectDetailView from '@/components/ProjectDetailView';
import ProjectContextMenu from '@/components/ProjectContextMenu';
import { ProjectPriorityBadge } from '@/components/ProjectBadges';
import type { Project, ProjectPriority, Task } from '@/utils/types';

const dayOf = (iso: string) => iso.split('T')[0];
const selectCls =
  'bg-background border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-purple transition-colors max-w-[9.5rem]';
const dateCls =
  'bg-background border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-purple transition-colors';

const PRIORITY_OPTS: { key: ProjectPriority; label: string }[] = [
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'normal', label: 'Normal' },
  { key: 'low', label: 'Low' },
];
type ProgressKey = 'not_started' | 'in_progress' | 'completed';
const PROGRESS_OPTS: { key: ProgressKey; label: string }[] = [
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

/** Where a project sits based on its tasks' completion. */
function progressOf(taskList: Task[]): ProgressKey {
  if (taskList.length === 0) return 'not_started';
  const done = taskList.filter((t) => t.status === 'completed').length;
  if (done === 0) return 'not_started';
  if (done === taskList.length) return 'completed';
  return 'in_progress';
}

function ProjectItem({
  project, selected, tasks, disabled, view, onSelect, onOpenMenu,
}: {
  project: Project;
  selected: boolean;
  tasks: Task[];
  disabled: boolean;
  view: 'list' | 'grid';
  onSelect: () => void;
  onOpenMenu: (x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, disabled });
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'completed').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const grip = !disabled && (
    <button
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className="text-text-disabled hover:text-text-secondary cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
      title="Drag to reorder"
      aria-label="Reorder project"
    >
      <GripVertical size={13} />
    </button>
  );

  const progress = (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-accent-green transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-text-secondary tabular-nums shrink-0">
        {total === 0 ? 'No tasks' : `${done}/${total} · ${pct}%`}
      </span>
    </div>
  );

  const wrapCls = `group border rounded-xl transition-colors ${
    selected
      ? 'border-accent-purple/40 bg-accent-purple/[0.06]'
      : 'border-border hover:border-accent-purple/30 hover:bg-black/[0.02]'
  }`;

  if (view === 'grid') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        onContextMenu={(e) => { e.preventDefault(); onOpenMenu(e.clientX, e.clientY); }}
        className={`${wrapCls} relative flex flex-col`}
      >
        <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full" style={{ backgroundColor: project.color }} />
        {!disabled && <span className="absolute right-1.5 top-1.5">{grip}</span>}
        <button onClick={onSelect} className="flex-1 text-left p-4 pl-5">
          <span className={`block text-sm truncate ${selected ? 'font-semibold text-accent-purple' : 'font-medium text-text-primary'}`}>
            {project.name}
          </span>
          <span className="mt-1.5 block"><ProjectPriorityBadge priority={project.priority} /></span>
          {project.description && (
            <p className="text-[11px] text-text-secondary line-clamp-2 mt-2">{project.description}</p>
          )}
          <div className="mt-3">{progress}</div>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onContextMenu={(e) => { e.preventDefault(); onOpenMenu(e.clientX, e.clientY); }}
      className={`${wrapCls} flex items-stretch`}
    >
      {!disabled && <span className="shrink-0 pl-1 flex items-center">{grip}</span>}
      <button onClick={onSelect} className="flex-1 min-w-0 flex items-center gap-3 px-3.5 py-3 text-left">
        <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-sm truncate ${selected ? 'font-semibold text-accent-purple' : 'font-medium text-text-primary'}`}>
              {project.name}
            </span>
            <ProjectPriorityBadge priority={project.priority} />
          </div>
          {project.description && (
            <p className="text-[11px] text-text-secondary truncate mt-0.5">{project.description}</p>
          )}
        </div>
        <div className="hidden sm:block w-52 shrink-0">{progress}</div>
        <ChevronRight size={15} className="text-text-disabled shrink-0" />
      </button>
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, tasks, reorderProjects, fetchTaskActivity } = useTaskStore();
  const { workspace } = useWorkspaceStore();
  const projectStatuses = useProjectStatuses();
  const canManage = useCan('manageProjects');

  // Always starts in List view — this is intentionally not persisted.
  const [view, setView] = useState<'list' | 'grid'>('list');
  // Nothing opens on load — the detail drawer appears only after the user picks
  // a project from the list.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | ProjectPriority>('all');
  const [progressFilter, setProgressFilter] = useState<'all' | ProgressKey>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (workspace) void fetchTaskActivity(workspace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const ordered = useMemo(() => [...projects].sort((a, b) => a.order - b.order), [projects]);
  const menuProject = menu ? ordered.find((p) => p.id === menu.id) ?? null : null;

  // If the project behind an open menu disappears, drop the menu.
  useEffect(() => {
    if (menu && !menuProject) setMenu(null);
  }, [menu, menuProject]);

  // Drop the selection only if that project no longer exists — never auto-select.
  useEffect(() => {
    setSelectedId((cur) => (cur && ordered.some((p) => p.id === cur) ? cur : null));
  }, [ordered]);

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

  const rangeActive = Boolean(fromDate && toDate && fromDate <= toDate);
  const filtersActive =
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    progressFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '';

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setProgressFilter('all');
    setFromDate('');
    setToDate('');
  };

  const filtered = useMemo(
    () =>
      ordered.filter((p) => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
        if (progressFilter !== 'all' && progressOf(tasksByProject.get(p.id) ?? []) !== progressFilter) return false;
        if (rangeActive) {
          if (!p.dueDate) return false;
          const d = dayOf(p.dueDate);
          if (d < fromDate || d > toDate) return false;
        }
        return true;
      }),
    [ordered, tasksByProject, statusFilter, priorityFilter, progressFilter, rangeActive, fromDate, toDate],
  );

  // Reordering only makes sense over the full, unfiltered list.
  const canReorder = canManage && !filtersActive;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !workspace) return;
    const ids = ordered.map((p) => p.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    void reorderProjects(workspace.id, arrayMove(ids, oldIndex, newIndex));
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: Project) => { setEditing(p); setModalOpen(true); };
  const closeDrawer = () => setSelectedId(null);

  const viewBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
      active ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
    }`;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar — the page title lives in the top bar, not here */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls} title="Status">
          <option value="all">All statuses</option>
          {projectStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as 'all' | ProjectPriority)}
          className={selectCls}
          title="Priority"
        >
          <option value="all">All priorities</option>
          {PRIORITY_OPTS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>

        <select
          value={progressFilter}
          onChange={(e) => setProgressFilter(e.target.value as 'all' | ProgressKey)}
          className={selectCls}
          title="Progress"
        >
          <option value="all">Any progress</option>
          {PROGRESS_OPTS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>

        <div className="flex items-center gap-1 text-xs text-text-secondary">
          <CalendarRange size={14} className="shrink-0" />
          <span className="font-medium">Due</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className={dateCls}
            title="Due on or after"
          />
          <span className="text-text-disabled">→</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className={dateCls}
            title="Due on or before"
          />
        </div>

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-background text-xs text-text-secondary hover:text-accent-red hover:border-accent-red/40 transition-colors"
          >
            <X size={12} /> Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 bg-black/[0.04] rounded-lg">
            <button onClick={() => setView('list')} className={viewBtn(view === 'list')} title="List view">
              <ListIcon size={13} /> List
            </button>
            <button onClick={() => setView('grid')} className={viewBtn(view === 'grid')} title="Grid view">
              <LayoutGrid size={13} /> Grid
            </button>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
            >
              <Plus size={13} /> New Project
            </button>
          )}
        </div>
      </div>

      {/* Project list / grid — spans the full content width, no vertical divider */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
              <FolderKanban size={28} className="text-accent-purple" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">No projects yet</h2>
            <p className="text-sm text-text-secondary">
              {canManage ? 'Create a project to group its tasks and track contributions.' : 'No projects have been created yet.'}
            </p>
            {canManage && (
              <button onClick={openCreate} className="px-4 py-2 bg-accent-purple text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
                New Project
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-black/[0.04] flex items-center justify-center">
              <FolderKanban size={24} className="text-text-secondary" />
            </div>
            <p className="text-sm font-medium text-text-primary">No projects match these filters</p>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={12} /> Clear filters
            </button>
          </div>
        ) : (
          <div className="w-full">
            {filtersActive && (
              <p className="text-[11px] text-text-secondary mb-3 tabular-nums">
                {filtered.length} of {ordered.length} project{ordered.length === 1 ? '' : 's'}
              </p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={filtered.map((p) => p.id)}
                strategy={view === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
              >
                <div className={view === 'grid' ? 'grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-2'}>
                  {filtered.map((p) => (
                    <ProjectItem
                      key={p.id}
                      project={p}
                      selected={p.id === selectedId}
                      tasks={tasksByProject.get(p.id) ?? []}
                      disabled={!canReorder || filtered.length < 2}
                      view={view}
                      onSelect={() => setSelectedId(p.id)}
                      onOpenMenu={(x, y) => setMenu({ id: p.id, x, y })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* Detail drawer — slides in from the right only when a project is selected */}
      <AnimatePresence>
        {selectedId && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeDrawer}
              className="fixed inset-0 z-40 bg-black/25"
            />
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.24, ease: 'easeOut' }}
              className="fixed right-0 top-0 h-full w-[560px] max-w-[94vw] bg-surface border-l border-border shadow-2xl z-50 overflow-y-auto"
            >
              <ProjectDetailView
                key={selectedId}
                projectId={selectedId}
                onEdit={openEdit}
                onClose={closeDrawer}
                onDeleted={closeDrawer}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {modalOpen && <ProjectModal project={editing} onClose={() => { setModalOpen(false); setEditing(null); }} />}

      {menu && menuProject && (
        <ProjectContextMenu
          project={menuProject}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onView={() => setSelectedId(menuProject.id)}
          onEdit={() => openEdit(menuProject)}
        />
      )}
    </div>
  );
}
