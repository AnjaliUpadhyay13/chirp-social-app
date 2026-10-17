import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { fetchUnreadCount } from '../services/notifications.js';

const NotificationContext = createContext(null);
const POLL_MS = 30_000;

// Keeps the unread badge fresh: on login, every 30s while the tab is visible, and when the window regains focus.
export function NotificationProvider({ children }) {
  const { status } = useAuth();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try { setUnread(await fetchUnreadCount()); } catch { /* badge is best-effort */ }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') { setUnread(0); return undefined; }
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [status, refresh]);

  const value = useMemo(() => ({ unread, setUnread, refresh }), [unread, refresh]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
};
