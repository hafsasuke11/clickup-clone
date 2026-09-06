import { useState } from 'react';
import { Filter, Users, ArrowUpDown, X, ChevronDown } from 'lucide-react';
import { useTaskStore, type TaskSortKey } from '@/store/taskStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { TaskPriority } from '@/utils/types';

function TB({ icon, label, onClick, active }: {
  icon?: React.ReactNode; label?: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap ${
      active ? 'bg-accent-purple/10 border-accent-purple/30 text-accent-purple'
      : 'bg-background border-border text-text-secondary hover:text-text-primary'
    }`}>{icon}{label && <span>{label}</span>}</button>
  );
}

function Popover({ open, onClose, children, width = 'w-56' }: {
  open: boolean; onClose: () => void; children: React.ReactNode; width?: string;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute right-0 top-full mt-1.5 ${width} bg-surface border border-border rounded-xl shadow-xl z-50 p-2`}>
        {children}
      </div>
    </>
  );
}

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

export function FilterButton() {
  const { filterPriorities, toggleFilterPriority, clearTaskFilters } = useTaskStore();
  const [open, setOpen] = useState(false);
  const active = filterPriorities.length > 0;

  return (
    <div className="relative">
      <TB icon={<Filter size={13} />} label={active ? `Filter (${filterPriorities.length})` : 'Filter'} active={active} onClick={() => setOpen((v) => !v)} />
      <Popover open={open} onClose={() => setOpen(false)}>
        <p className="px-2 py-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Priority</p>
        {PRIORITIES.map((p) => (
          <label key={p} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.03] cursor-pointer transition-colors">
            <input type="checkbox" checked={filterPriorities.includes(p)} onChange={() => toggleFilterPriority(p)}
              className="w-3.5 h-3.5 rounded border border-border bg-transparent accent-accent-purple" />
            <span className="text-xs text-text-primary capitalize">{p}</span>
          </label>
        ))}
        {active && (
          <button onClick={clearTaskFilters} className="w-full mt-1 px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary text-left border-t border-border flex items-center gap-1.5">
            <X size={11} /> Clear filters
          </button>
        )}
      </Popover>
    </div>
  );
}

export function AssigneeButton() {
  const { filterAssigneeIds, toggleFilterAssigneeId } = useTaskStore();
  const { members } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const active = filterAssigneeIds.length > 0;

  if (members.length === 0) return null;

  return (
    <div className="relative">
      <TB icon={<Users size={13} />} label={active ? `Assignee (${filterAssigneeIds.length})` : 'Assignee'} active={active} onClick={() => setOpen((v) => !v)} />
      <Popover open={open} onClose={() => setOpen(false)}>
        <p className="px-2 py-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Assignee</p>
        {members.map((m) => (
          <label key={m.userId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.03] cursor-pointer transition-colors">
            <input type="checkbox" checked={filterAssigneeIds.includes(m.userId)} onChange={() => toggleFilterAssigneeId(m.userId)}
              className="w-3.5 h-3.5 rounded border border-border bg-transparent accent-accent-purple" />
            <span className="text-xs text-text-primary">{m.user?.fullName}</span>
          </label>
        ))}
      </Popover>
    </div>
  );
}

const SORT_OPTIONS: { key: TaskSortKey; label: string }[] = [
  { key: 'created', label: 'Date created' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'name', label: 'Name' },
];

export function SortButton() {
  const { sortKey, sortAsc, setSortKey, toggleSortAsc } = useTaskStore();
  const [open, setOpen] = useState(false);
  const currentLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Sort';

  return (
    <div className="relative">
      <TB icon={<ArrowUpDown size={13} />} label={`Sort: ${currentLabel}`} onClick={() => setOpen((v) => !v)} />
      <Popover open={open} onClose={() => setOpen(false)}>
        {SORT_OPTIONS.map((o) => (
          <button key={o.key} onClick={() => { setSortKey(o.key); setOpen(false); }}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
              sortKey === o.key ? 'text-accent-purple bg-accent-purple/10' : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.03]'
            }`}>
            {o.label}
          </button>
        ))}
        <button onClick={() => toggleSortAsc()} className="w-full mt-1 px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary text-left border-t border-border flex items-center gap-1.5">
          <ChevronDown size={11} className={sortAsc ? '' : 'rotate-180'} /> {sortAsc ? 'Ascending' : 'Descending'}
        </button>
      </Popover>
    </div>
  );
}
