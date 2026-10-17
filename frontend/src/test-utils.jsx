import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import App from './App.jsx';

export const USER = { id: '1', name: 'Anjali Upadhyay', username: 'anjali_u', email: 'anjali@example.com', avatar: '' };

const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
export const okRes = (data, status = 200) => res(status, { success: true, data });
export const errRes = (status, code, message, details) => res(status, { success: false, error: { code, message, ...(details ? { details } : {}) } });

// routes: { 'GET /auth/me': () => response | response, ... }  (unlisted calls return 404)
export function mockApi(routes = {}) {
  const calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const full = `${opts.method || 'GET'} ${String(url).replace(/^.*\/api\/v1/, '')}`;
    const key = full.split('?')[0];
    calls.push({ key, full, body: opts.body ? JSON.parse(opts.body) : undefined });
    const handler = routes[full] ?? routes[key];
    if (handler === undefined) return errRes(404, 'NOT_FOUND', `no mock for ${full}`);
    return typeof handler === 'function' ? handler(opts, full) : handler;
  });
  return calls;
}

export const ME = USER;
export const post = (n, extra = {}) => ({
  id: `p${n}`, text: `post number ${n}`, hashtags: [], replyTo: null, rootPost: null,
  author: { id: '2', name: 'Rohan Verma', username: 'rohan_v', avatar: '' },
  likeCount: 0, replyCount: 0, repostCount: 0, createdAt: new Date(Date.now() - n * 60000).toISOString(),
  viewer: { liked: false, reposted: false }, ...extra,
});
export const mine = (n, extra = {}) => post(n, { author: { id: USER.id, name: USER.name, username: USER.username, avatar: '' }, ...extra });
export const feedRes = (posts, nextCursor = null) => ({ ok: true, status: 200, json: async () => ({ success: true, data: { posts }, meta: { nextCursor } }) });

export const healthOk = okRes({ status: 'ok', uptime: 5, database: 'connected', time: '' });

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider><ToastProvider><AuthProvider><NotificationProvider><App /></NotificationProvider></AuthProvider></ToastProvider></ThemeProvider>
    </MemoryRouter>,
  );
}
