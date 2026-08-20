// ============================================
// WFM Platform — Toast Notification System
// Stacked notifications with auto-dismiss
// ============================================


import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: 'text-success-500',
  error: 'text-danger-500',
  warning: 'text-warning-500',
  info: 'text-brand-500',
};

const borders = {
  success: 'border-l-success-500',
  error: 'border-l-danger-500',
  warning: 'border-l-warning-500',
  info: 'border-l-brand-500',
};

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  return (
    <div className="toast-container z-50 fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: { id: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; duration?: number };
  onDismiss: () => void;
}) {
  const Icon = icons[toast.type];

  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration || 3500);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex items-center gap-3 min-w-[300px] max-w-[400px] px-4 py-3.5 rounded-lg bg-surface-0 dark:bg-surface-0/60 dark:backdrop-blur-2xl shadow-xl border border-surface-200 dark:border-white/10 border-l-[4px] ${borders[toast.type]} pointer-events-auto`}
    >
      <Icon className={`${colors[toast.type]} flex-shrink-0`} size={20} />
      <p className="text-sm font-medium text-surface-800 flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors flex-shrink-0 outline-none"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
