import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icons.jsx';

const ToastContext = createContext(null);
const ICONS = { success: 'check', error: 'alert', info: 'info' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((type, message, duration = 4000) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, d) => push('success', m, d),
    error: (m, d) => push('error', m, d),
    info: (m, d) => push('info', m, d),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <Icon name={ICONS[t.type]} size={18} />
            <span className="toast__msg">{t.message}</span>
            <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};
