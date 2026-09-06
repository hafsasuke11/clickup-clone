import { useState, useEffect, useRef } from 'react';
import { Search, X, CheckSquare } from 'lucide-react';
import { useTaskStore } from '@/store/taskStore';
import { useUiStore } from '@/store/uiStore';

export default function SearchModal() {
  const { tasks } = useTaskStore();
  const { setSearchOpen, setSelectedTaskId } = useUiStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.toLowerCase().trim();
  const matchedTasks = q ? tasks.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)).slice(0, 10) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-text-secondary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks..."
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-secondary text-base focus:outline-none"
          />
          {query
            ? <button onClick={() => setQuery('')} className="text-text-secondary hover:text-text-primary"><X size={16} /></button>
            : <button onClick={() => setSearchOpen(false)} className="text-xs text-text-secondary border border-border px-2 py-0.5 rounded">Esc</button>}
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {tasks.length === 0 && (
            <div className="py-12 text-center px-6">
              <p className="text-sm text-text-secondary">Your workspace is empty.</p>
              <p className="text-xs text-text-secondary mt-1">Create tasks to search through them.</p>
            </div>
          )}

          {!q && tasks.length > 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary">Type to search across {tasks.length} task{tasks.length !== 1 ? 's' : ''}…</p>
            </div>
          )}

          {q && matchedTasks.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-text-secondary">No results for "<span className="text-text-primary">{query}</span>"</p>
            </div>
          )}

          {matchedTasks.length > 0 && (
            <div className="px-4">
              {matchedTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTaskId(t.id); setSearchOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-black/[0.03] transition-colors text-left"
                >
                  <CheckSquare size={14} className="text-accent-green shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">{t.name}</p>
                    <p className="text-xs text-text-secondary">{t.status.replace('_', ' ')}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
                    t.priority === 'urgent' ? 'text-accent-red bg-accent-red/10'
                    : t.priority === 'high' ? 'text-accent-amber bg-accent-amber/10'
                    : 'text-accent-blue bg-accent-blue/10'
                  }`}>{t.priority}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-text-secondary">
          <span>↑↓ Navigate</span><span>↵ Select</span><span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
