import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { DEFAULT_TASK_STATUS_META } from '@/components/TaskStatusPill';

const priorityColors: Record<string, string> = {
  urgent: 'text-red-700 bg-red-50 border-red-200',
  high: 'text-orange-700 bg-orange-50 border-orange-200',
  normal: 'text-blue-700 bg-blue-50 border-blue-200',
};

const columns = [
  {
    status: 'pending' as const,
    tasks: [
      { name: 'Dashboard chart widgets', priority: 'high', due: 'Aug 4', initials: 'JS', color: 'bg-purple-500' },
      { name: 'Polish list empty states', priority: 'normal', due: null, initials: 'AK', color: 'bg-blue-500' },
    ],
  },
  {
    status: 'in_progress' as const,
    tasks: [
      { name: 'Kanban drag & drop polish', priority: 'urgent', due: 'Aug 1', initials: 'MR', color: 'bg-pink-500' },
      { name: 'Invite flow for teammates', priority: 'high', due: null, initials: 'HR', color: 'bg-amber-500' },
    ],
  },
  {
    status: 'completed' as const,
    tasks: [
      { name: 'Set up project workspace', priority: 'normal', due: null, initials: 'HR', color: 'bg-green-500' },
    ],
  },
];

function MiniCard({ task, i }: { task: (typeof columns)[number]['tasks'][number]; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className="bg-white border border-border rounded-lg p-2.5 space-y-2 cursor-default transition-colors hover:border-accent-purple/40"
    >
      <p className="text-[11px] text-text-primary leading-snug">{task.name}</p>
      <div className="flex items-center justify-between">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <div className="flex items-center gap-1.5">
          {task.due && (
            <span className="flex items-center gap-1 text-[9px] text-text-secondary">
              <Calendar size={9} />
              {task.due}
            </span>
          )}
          <div className={`w-4 h-4 rounded-full ${task.color} flex items-center justify-center text-[7px] font-bold text-white`}>
            {task.initials}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function BoardPreview() {
  return (
    <div className="w-full max-w-[560px] bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-[11px]"
          style={{ background: 'linear-gradient(135deg, #6D4FE0 0%, #EE46BC 50%, #F79009 100%)' }}
        >
          C
        </div>
        <span className="text-xs font-semibold text-text-primary">Product Roadmap</span>
        <span className="ml-auto flex -space-x-1.5">
          {['bg-purple-500', 'bg-blue-500', 'bg-pink-500'].map((c, i) => (
            <div key={c} className={`w-5 h-5 rounded-full ${c} border-2 border-white flex items-center justify-center text-[8px] font-bold text-white`}>
              {['H', 'A', 'M'][i]}
            </div>
          ))}
        </span>
      </div>
      <div className="flex gap-3 p-4 overflow-x-auto">
        {columns.map((col) => {
          const meta = DEFAULT_TASK_STATUS_META[col.status];
          return (
            <div key={col.status} className="flex-1 min-w-[150px]">
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                <span className="text-[10px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-[9px] text-text-disabled ml-auto">{col.tasks.length}</span>
              </div>
              <div className="space-y-2">
                {col.tasks.map((t, i) => (
                  <MiniCard key={t.name} task={t} i={i} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
