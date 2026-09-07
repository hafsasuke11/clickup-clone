import { useState } from 'react';
import { X, CheckSquare, Folder, AlertTriangle, Lock } from 'lucide-react';
import { useTaskStore, findDuplicateTask, type DuplicateTaskInfo } from '@/store/taskStore';
import { useWorkspaceStore, useTaskStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { useCan } from '@/utils/permissions';
import ConfirmDialog from './ConfirmDialog';
import type { TaskPriority, TaskStatus } from '@/utils/types';

type Tab = 'task' | 'project';

const COLORS = ['#6D4FE0', '#2E90FA', '#F79009', '#EE46BC', '#12B76A', '#F04438'];

export default function CreateModal() {
  const { workspace } = useWorkspaceStore();
  const taskStatuses = useTaskStatuses();
  const { createTask, createProject, projects, tasks } = useTaskStore();
  const { createModalDueDate, setCreateModalDueDate, setCreateModalOpen, addToast } = useUiStore();
  const canTasks = useCan('manageTasks');
  const canProjects = useCan('manageProjects');
  const canAssign = useCan('assignTasks');
  const [activeTab, setActiveTab] = useState<Tab>(canTasks ? 'task' : canProjects ? 'project' : 'task');
  const [dupPrompt, setDupPrompt] = useState<DuplicateTaskInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [taskName, setTaskName] = useState('');
  const [taskProject, setTaskProject] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('normal');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('pending');
  const [taskDue, setTaskDue] = useState(createModalDueDate ?? '');
  const [taskDesc, setTaskDesc] = useState('');

  const [projName, setProjName] = useState('');
  const [projColor, setProjColor] = useState(COLORS[0]);

  const close = () => { setCreateModalOpen(false); setCreateModalDueDate(null); };

  // A same-named task already loaded for this project — an instant, non-blocking hint.
  const localDuplicate =
    activeTab === 'task' && taskName.trim()
      ? findDuplicateTask(tasks, taskName, taskProject || null)
      : undefined;

  const createTheTask = async (force: boolean) => {
    if (!workspace) return;
    setSubmitting(true);
    try {
      const res = await createTask(workspace.id, {
        name: taskName.trim(),
        projectId: taskProject || null,
        priority: taskPriority,
        status: taskStatus,
        dueDate: taskDue || null,
        description: taskDesc,
      }, { force });
      if ('denied' in res) { close(); return; }
      if ('duplicate' in res) {
        setDupPrompt(res.duplicate);
        return;
      }
      close();
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!workspace) return;
    if (activeTab === 'task') {
      if (!taskName.trim()) return;
      await createTheTask(false);
    } else if (activeTab === 'project') {
      if (!projName.trim()) return;
      const p = await createProject(workspace.id, { name: projName.trim(), color: projColor });
      if (p) addToast(`Project "${projName.trim()}" created`, 'success');
      close();
    }
  };

  const noAccess = !canTasks && !canProjects;
  const tabs = [
    canTasks && { id: 'task' as Tab, label: 'Task', icon: <CheckSquare size={14} /> },
    canProjects && { id: 'project' as Tab, label: 'Project', icon: <Folder size={14} /> },
  ].filter(Boolean) as { id: Tab; label: string; icon: React.ReactNode }[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Create New</h2>
          <button onClick={close} className="text-text-secondary hover:text-text-primary"><X size={18} /></button>
        </div>

        {tabs.length > 1 && (
          <div className="flex border-b border-border px-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === t.id ? 'text-accent-purple border-accent-purple' : 'text-text-secondary border-transparent hover:text-text-primary'
                }`}
              >
                <span className={activeTab === t.id ? 'text-accent-purple' : ''}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {noAccess ? (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black/[0.04] flex items-center justify-center">
              <Lock size={20} className="text-text-secondary" />
            </div>
            <p className="text-sm text-text-primary font-medium">You don't have permission to create anything here</p>
            <p className="text-xs text-text-secondary max-w-xs">Ask the workspace owner to grant you “Create &amp; edit tasks” or “Create &amp; edit projects”.</p>
          </div>
        ) : (
        <div className="px-5 py-5 space-y-4">
          {activeTab === 'task' && (
            <>
              <div>
                <input value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="Task name *" autoFocus
                  className={`w-full bg-background border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none transition-colors ${
                    localDuplicate ? 'border-accent-amber focus:border-accent-amber' : 'border-border focus:border-accent-purple'
                  }`} />
                {localDuplicate && (
                  <p className="flex items-center gap-1.5 mt-1.5 text-[11px] text-accent-amber">
                    <AlertTriangle size={12} className="shrink-0" />
                    A task named “{localDuplicate.name}” already exists in this project.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Project</label>
                  <select value={taskProject} onChange={(e) => setTaskProject(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors">
                    <option value="">No project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Status</label>
                  <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors">
                    {taskStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Priority</label>
                  <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors">
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Due Date</label>
                  <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors" />
                </div>
              </div>
              <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Description (optional)" rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple transition-colors resize-none" />
            </>
          )}

          {activeTab === 'project' && (
            <>
              <input value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="Project name *" autoFocus
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple transition-colors" />
              <div>
                <label className="block text-xs text-text-secondary mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setProjColor(c)} style={{ background: c }}
                      className={`w-7 h-7 rounded-full transition-all ${projColor === c ? 'ring-2 ring-accent-purple ring-offset-2 ring-offset-surface' : ''}`} />
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'task' && taskProject && !canAssign && (
            <p className="text-[11px] text-text-secondary">
              You can create tasks but not assign them — the new task will be unassigned.
            </p>
          )}
        </div>
        )}

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={close} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border rounded-lg transition-colors">{noAccess ? 'Close' : 'Cancel'}</button>
          {!noAccess && (
            <button onClick={submit} disabled={submitting} className="px-5 py-2 text-sm bg-accent-purple text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50">
              Create {activeTab === 'task' ? 'Task' : 'Project'}
            </button>
          )}
        </div>
      </div>

      {dupPrompt && (
        <ConfirmDialog
          title="This task already exists"
          message={`A task named “${dupPrompt.name}” already exists in this project. Adding it again will create a duplicate.`}
          confirmLabel="Add anyway"
          loading={submitting}
          onConfirm={() => { void createTheTask(true).then(() => setDupPrompt(null)); }}
          onCancel={() => setDupPrompt(null)}
        />
      )}
    </div>
  );
}
