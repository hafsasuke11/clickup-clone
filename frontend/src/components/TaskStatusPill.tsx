import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { WorkspaceStatus } from '@/utils/types';

/** Swatches offered when creating a new status. */
export const STATUS_PALETTE = [
  '#64748B', '#6366F1', '#3B82F6', '#06B6D4', '#14B8A6',
  '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6',
];

/** Inline styles for a coloured chip — hex + alpha so any custom colour works. */
export function statusTint(color: string) {
  return { color, backgroundColor: `${color}1A`, borderColor: `${color}40` };
}

export function resolveStatus(statuses: WorkspaceStatus[], key: string): { label: string; color: string } {
  const found = statuses.find((s) => s.key === key);
  if (found) return { label: found.label, color: found.color };
  // Unknown key (e.g. a status deleted elsewhere): show it readably.
  return { label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), color: '#64748B' };
}

/** Static fallback used only by the marketing board preview (no workspace there). */
export const DEFAULT_TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#64748B' },
  in_progress: { label: 'In Progress', color: '#3B82F6' },
  completed: { label: 'Completed', color: '#22C55E' },
};

export function StatusDot({ color }: { color: string }) {
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

export function StatusPill({
  statuses, status, size = 'md',
}: { statuses: WorkspaceStatus[]; status: string; size?: 'sm' | 'md' }) {
  const { label, color } = resolveStatus(statuses, status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      }`}
      style={statusTint(color)}
    >
      <StatusDot color={color} />
      {label}
    </span>
  );
}

/**
 * A clickable status control: shows the current status as a pill and opens a
 * dropdown (portalled, so it is never clipped) to change it.
 */
export function StatusSelect({
  statuses, status, onChange, size = 'md',
}: {
  statuses: WorkspaceStatus[];
  status: string;
  onChange: (key: string) => void;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const { label, color } = resolveStatus(statuses, status);
  const small = size === 'sm';

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, [open]);

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide transition-all hover:brightness-95 ${
          small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        }`}
        style={statusTint(color)}
      >
        <StatusDot color={color} />
        {label}
        <ChevronDown size={small ? 10 : 12} className="opacity-60" />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed w-44 max-h-72 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl z-[61] py-1"
            style={{ top: pos.top, left: pos.left }}
          >
            {statuses.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => { onChange(s.key); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-black/[0.03] ${
                  s.key === status ? 'font-semibold text-text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <StatusDot color={s.color} />
                {s.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
