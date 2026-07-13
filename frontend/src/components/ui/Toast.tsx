import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { dismissToast } from '@/features/ui/uiSlice';
import type { Toast } from '@/features/ui/uiSlice';
import styles from './Toast.module.scss';

const AUTO_DISMISS_MS = 5000;

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = setTimeout(() => dispatch(dismissToast(toast.id)), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dispatch]);

  return (
    <div
      className={`${styles.toast} ${styles[toast.tone]}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span className={styles.dot} aria-hidden />
      <span className={styles.message}>{toast.message}</span>
      <button
        className={styles.close}
        aria-label="Dismiss notification"
        onClick={() => dispatch(dismissToast(toast.id))}
      >
        &times;
      </button>
    </div>
  );
}

/** Fixed-position notification stack. Mount once, at the app root. */
export function ToastHost() {
  const toasts = useAppSelector((s) => s.ui.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className={styles.host}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
