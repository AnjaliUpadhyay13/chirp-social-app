import { api } from './api.js';

const qs = (params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const getNotifications = (cursor, signal) => api(`/notifications${qs({ limit: 20, cursor })}`, { signal });
export const fetchUnreadCount = (signal) => api('/notifications/unread-count', { signal }).then((r) => r.data.unreadCount);
export const markRead = (id) => api(`/notifications/${id}/read`, { method: 'PATCH' }).then((r) => r.data);
export const markAllRead = () => api('/notifications/read-all', { method: 'PATCH' }).then((r) => r.data);
