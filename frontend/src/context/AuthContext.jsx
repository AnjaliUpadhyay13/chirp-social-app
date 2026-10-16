import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/auth.js';

const AuthContext = createContext(null);

// status: 'loading' (checking session) | 'authenticated' | 'guest'
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  // Restore the session from the httpOnly cookie on first load
  useEffect(() => {
    const controller = new AbortController();
    authService.fetchMe(controller.signal)
      .then((u) => { setUser(u); setStatus('authenticated'); })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setUser(null);
        setStatus('guest'); // 401 (not logged in) or server unreachable -> show login
      });
    return () => controller.abort();
  }, []);

  const login = useCallback(async (payload) => {
    const u = await authService.loginUser(payload);
    setUser(u); setStatus('authenticated');
    return u;
  }, []);

  const register = useCallback(async (payload) => {
    const u = await authService.registerUser(payload);
    setUser(u); setStatus('authenticated');
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logoutUser(); } finally { setUser(null); setStatus('guest'); }
  }, []);

  const updateUser = useCallback((u) => setUser(u), []);

  const value = useMemo(() => ({ user, status, login, register, logout, updateUser }), [user, status, login, register, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
