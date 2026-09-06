import { Circle, CircleDot, ListChecks, CheckCircle2 } from 'lucide-react';
import type { TaskStatus } from '@/utils/types';

export const STATUS_META: Record<TaskStatus, {
  label: string;
  icon: typeof Circle;
  text: string;
  bg: string;
  border: string;
  topBorder: string;
  dot: string;
}> = {
  pending: {
    label: 'Pending',
    icon: Circle,
    text: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    topBorder: 'border-t-slate-400',
    dot: 'bg-slate-400',
  },
  in_progress: {
    label: 'In Progress',
    icon: CircleDot,
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    topBorder: 'border-t-blue-400',
    dot: 'bg-blue-500',
  },
  todo: {
    label: 'To Do',
    icon: ListChecks,
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    topBorder: 'border-t-amber-400',
    dot: 'bg-amber-500',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    text: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-300',
    topBorder: 'border-t-green-400',
    dot: 'bg-green-500',
  },
};

export const TASK_STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'todo', 'completed'];

export function StatusPill({ status, size = 'md', onClick }: {
  status: TaskStatus; size?: 'sm' | 'md'; onClick?: () => void;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide transition-all ${meta.bg} ${meta.border} ${meta.text} ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      } ${onClick ? 'hover:brightness-95 cursor-pointer' : ''}`}
    >
      <Icon size={size === 'sm' ? 10 : 12} strokeWidth={2.5} />
      {meta.label}
    </Tag>
  );
}

export function StatusDot({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return <span className={`w-2 h-2 rounded-full ${meta.dot}`} />;
}
