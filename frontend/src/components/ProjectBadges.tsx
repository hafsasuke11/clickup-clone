import type { ProjectPriority } from '@/utils/types';

export const PROJECT_PRIORITY_ORDER: ProjectPriority[] = ['urgent', 'high', 'normal', 'low'];

export const PROJECT_PRIORITY_META: Record<ProjectPriority, { label: string; cls: string; dot: string; rank: number }> = {
  urgent: { label: 'Urgent', cls: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500', rank: 0 },
  high: { label: 'High', cls: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-500', rank: 1 },
  normal: { label: 'Normal', cls: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500', rank: 2 },
  low: { label: 'Low', cls: 'text-gray-600 bg-gray-50 border-gray-200', dot: 'bg-gray-400', rank: 3 },
};

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  const meta = PROJECT_PRIORITY_META[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border font-medium ${meta.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
