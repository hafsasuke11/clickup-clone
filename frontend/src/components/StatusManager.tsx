import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Settings2 } from 'lucide-react';
import { useWorkspaceStore, useStatuses } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { STATUS_PALETTE, StatusDot } from './TaskStatusPill';
import type { StatusKind, WorkspaceStatus } from '@/utils/types';

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ background: c }}
          className={`w-5 h-5 rounded-full transition-all ${value === c ? 'ring-2 ring-offset-1 ring-offset-surface ring-accent-purple' : ''}`}
        />
      ))}
    </div>
  );
}

/** Inline "add a status" form (label + colour). */
export function AddStatusForm({ kind, onDone }: { kind: StatusKind; onDone?: () => void }) {
  const addStatus = useWorkspaceStore((s) => s.addStatus);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(STATUS_PALETTE[1]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      await addStatus(kind, label.trim(), color);
      setLabel('');
      onDone?.();
    } catch (err) {
      useUiStore.getState().addToast(err instanceof Error ? err.message : 'Failed to add status', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); if (e.key === 'Escape') onDone?.(); }}
        placeholder="Status name"
        className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-purple"
      />
      <Swatches value={color} onChange={setColor} />
      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={submit}
          disabled={!label.trim() || busy}
          className="flex-1 px-2 py-1.5 bg-accent-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add status'}
        </button>
        {onDone && (
          <button onClick={onDone} className="px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary border border-border rounded-lg">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/** One editable row: rename, recolour, reorder, delete. */
function StatusRow({
  kind, status, index, total,
}: { kind: StatusKind; status: WorkspaceStatus; index: number; total: number }) {
  const { updateStatus, deleteStatus, reorderStatuses } = useWorkspaceStore();
  const statuses = useStatuses(kind);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(status.label);
  const [color, setColor] = useState(status.color);
  const [confirmDel, setConfirmDel] = useState(false);

  const move = (dir: -1 | 1) => {
    const keys = statuses.map((s) => s.key);
    const j = index + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[index], keys[j]] = [keys[j], keys[index]];
    void reorderStatuses(kind, keys);
  };

  const save = async () => {
    await updateStatus(kind, status.key, { label: label.trim() || status.label, color });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="p-2 rounded-lg bg-black/[0.02] space-y-2">
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-purple"
        />
        <Swatches value={color} onChange={setColor} />
        <div className="flex items-center gap-2">
          <button onClick={save} className="flex items-center gap-1 px-2 py-1 bg-accent-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-700">
            <Check size={12} /> Save
          </button>
          <button onClick={() => { setEditing(false); setLabel(status.label); setColor(status.color); }} className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <div className="flex flex-col text-text-disabled">
        <button onClick={() => move(-1)} disabled={index === 0} className="hover:text-text-primary disabled:opacity-30 leading-none">▲</button>
        <button onClick={() => move(1)} disabled={index === total - 1} className="hover:text-text-primary disabled:opacity-30 leading-none">▼</button>
      </div>
      <StatusDot color={status.color} />
      <span className="text-xs text-text-primary flex-1 truncate">{status.label}</span>
      {status.builtIn && <span className="text-[9px] text-text-disabled uppercase tracking-wide">built-in</span>}
      <button onClick={() => setEditing(true)} className="p-1 text-text-secondary hover:text-accent-purple opacity-0 group-hover:opacity-100 transition-opacity" title="Edit">
        <Pencil size={12} />
      </button>
      {!status.builtIn && (
        confirmDel ? (
          <span className="flex items-center gap-1">
            <button onClick={() => { void deleteStatus(kind, status.key); setConfirmDel(false); }} className="text-[10px] text-accent-red font-semibold">Delete</button>
            <button onClick={() => setConfirmDel(false)} className="text-text-secondary"><X size={12} /></button>
          </span>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="p-1 text-text-secondary hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
            <Trash2 size={12} />
          </button>
        )
      )}
    </div>
  );
}

/** Full manager: list every status with edit/reorder/delete plus an add form. */
function StatusManagerPanel({ kind }: { kind: StatusKind }) {
  const statuses = useStatuses(kind);
  const [adding, setAdding] = useState(false);
  return (
    <div className="w-64">
      <p className="px-1 pb-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
        {kind === 'task' ? 'Task statuses' : 'Project statuses'}
      </p>
      <div className="divide-y divide-border">
        {statuses.map((s, i) => (
          <StatusRow key={s.key} kind={kind} status={s} index={i} total={statuses.length} />
        ))}
      </div>
      <div className="pt-2 mt-1 border-t border-border">
        {adding ? (
          <AddStatusForm kind={kind} onDone={() => setAdding(false)} />
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs text-accent-purple font-semibold hover:underline">
            <Plus size={13} /> Add status
          </button>
        )}
      </div>
    </div>
  );
}

/** Small gear on a board column / list group header → popover to edit just that status. */
export function StatusColumnMenu({
  kind, statusKey, align = 'right',
}: { kind: StatusKind; statusKey: string; align?: 'left' | 'right' }) {
  const statuses = useStatuses(kind);
  const [open, setOpen] = useState(false);
  const index = statuses.findIndex((s) => s.key === statusKey);
  const status = statuses[index];
  if (!status) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 text-text-disabled hover:text-text-primary rounded transition-colors"
        title="Edit status"
      >
        <Settings2 size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 w-60 bg-surface border border-border rounded-xl shadow-xl z-50 p-2`}>
            <StatusRow kind={kind} status={status} index={index} total={statuses.length} />
          </div>
        </>
      )}
    </div>
  );
}

/** Compact toolbar button: "+ Status" → popover with the add form. */
export function AddStatusButton({ kind, label = 'Status' }: { kind: StatusKind; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
      >
        <Plus size={13} /> {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 w-60 bg-surface border border-border rounded-xl shadow-xl z-50 p-3">
            <p className="pb-2 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
              New {kind === 'task' ? 'task' : 'project'} status
            </p>
            <AddStatusForm kind={kind} onDone={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

/** Toolbar button that opens the status manager in a popover. */
export function ManageStatusesButton({ kind }: { kind: StatusKind }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-text-secondary hover:text-text-primary transition-colors"
      >
        <Settings2 size={13} /> Statuses
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 bg-surface border border-border rounded-xl shadow-xl z-50 p-3">
            <StatusManagerPanel kind={kind} />
          </div>
        </>
      )}
    </div>
  );
}
