import { Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';

const PAGE_TITLES: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/list': 'List',
  '/app/board': 'Board',
  '/app/projects': 'Projects',
  '/app/calendar': 'Calendar',
  '/app/users': 'Users',
  '/app/activity': 'Activity',
  '/app/profile': 'Profile',
};

// Task creation lives contextually per page (Kanban's toolbar, List's inline
// rows, Calendar's per-day "+") rather than duplicated here — this bar is
// just identity + search.
export default function Topbar() {
  const { setSearchOpen } = useUiStore();
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname];

  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface flex items-center gap-4 px-6">
      <h1 className="text-base font-bold text-text-primary shrink-0 w-24">{title ?? ''}</h1>

      <div className="flex-1 flex justify-center">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-border bg-background text-sm text-text-secondary hover:text-text-primary hover:border-accent-purple/40 transition-colors w-full max-w-md"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Search tasks...</span>
          <span className="text-[10px] border border-border rounded px-1.5 py-0.5 text-text-disabled">Ctrl K</span>
        </button>
      </div>

      <div className="shrink-0 w-24" />
    </header>
  );
}
