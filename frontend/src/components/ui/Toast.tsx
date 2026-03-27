import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// Simple global event bus for toasts
type ToastListener = (toast: Toast) => void;
const listeners = new Set<ToastListener>();

// eslint-disable-next-line react-refresh/only-export-components
export const toast = {
  success: (message: string) => emit('success', message),
  error:   (message: string) => emit('error',   message),
  info:    (message: string) => emit('info',     message),
};

function emit(type: ToastType, message: string) {
  const id = `${Date.now()}-${Math.random()}`;
  listeners.forEach(fn => fn({ id, type, message }));
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  error:   <XCircle      className="w-4 h-4 text-rose-400" />,
  info:    <Info         className="w-4 h-4 text-blue-400" />,
};

const COLORS: Record<ToastType, string> = {
  success: 'border-emerald-500/30',
  error:   'border-rose-500/30',
  info:    'border-blue-500/30',
};

const AUTO_DISMISS_MS = 4000;

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler: ToastListener = (toast) => {
      setToasts(prev => [...prev.slice(-4), toast]); // max 5 visible
      setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, [dismiss]);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 8,  scale: 0.95  }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`
              pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl
              glass border shadow-xl min-w-[256px] max-w-[360px]
              ${COLORS[t.type]}
            `}
          >
            <span className="flex-shrink-0 mt-0.5">{ICONS[t.type]}</span>
            <span className="text-sm text-white/90 leading-snug flex-grow">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ToastContainer;
