import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';

export default function ToastContainer() {
  const { toasts, removeToast } = useUiStore();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl shadow-xl min-w-[260px] max-w-xs pointer-events-auto animate-slide-up"
        >
          {t.type === 'success' && <CheckCircle size={16} className="text-accent-green shrink-0" />}
          {t.type === 'error' && <AlertCircle size={16} className="text-accent-red shrink-0" />}
          {t.type === 'info' && <Info size={16} className="text-accent-blue shrink-0" />}
          <span className="flex-1 text-sm text-text-primary">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="text-text-secondary hover:text-text-primary shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
