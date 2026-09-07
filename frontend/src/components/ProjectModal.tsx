import { useState } from 'react';
import { X } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useWorkspaceStore, useProjectStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import type { Project, ProjectPriority, ProjectStatus } from '@/utils/types';
import { PROJECT_PRIORITY_META, PROJECT_PRIORITY_ORDER } from './ProjectBadges';

const COLORS = ['#6D4FE0', '#2E90FA', '#F79009', '#EE46BC', '#12B76A', '#F04438'];

function toDateInput(value: string | null): string {
  return value ? new Date(value).toISOString().split('T')[0] : '';
}

export default function ProjectModal({ project, onClose }: { project?: Project | null; onClose: () => void }) {
  const { workspace } = useWorkspaceStore();
  const projectStatuses = useProjectStatuses();
  const { createProject, updateProject } = useTaskStore();
  const { addToast } = useUiStore();
  const isEdit = Boolean(project);

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? COLORS[0]);
  const [priority, setPriority] = useState<ProjectPriority>(project?.priority ?? 'normal');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'active');
  const [startDate, setStartDate] = useState(toDateInput(project?.startDate ?? null));
  const [dueDate, setDueDate] = useState(toDateInput(project?.dueDate ?? null));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!workspace || !name.trim() || saving) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      description,
      color,
      priority,
      status,
      startDate: startDate || null,
      dueDate: dueDate || null,
    };
    try {
      if (isEdit && project) {
        await updateProject(workspace.id, project.id, payload);
        addToast(`Project "${payload.name}" updated`, 'success');
      } else {
        await createProject(workspace.id, payload);
        addToast(`Project "${payload.name}" created`, 'success');
      }
      onClose();
    } catch {
      addToast('Something went wrong. Please try again.', 'error');
      setSaving(false);
    }
  };

  const fieldCls =
    'w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">{isEdit ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={18} /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name *"
            autoFocus
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple transition-colors"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple transition-colors resize-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as ProjectPriority)} className={fieldCls}>
                {PROJECT_PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>{PROJECT_PRIORITY_META[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={fieldCls}>
                {projectStatuses.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-accent-purple ring-offset-2 ring-offset-surface' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border rounded-lg transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={!name.trim() || saving}
            className="px-5 py-2 text-sm bg-accent-purple text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
