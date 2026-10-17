import { api } from './api.js';

const qs = (params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  const s = q.toString();
  return s ? `?${s}` : '';
};

// Posts are cursor-paginated; people are a single capped list (no meta).
export const searchPosts = (q, cursor, signal) => api(`/search${qs({ q, type: 'posts', limit: 20, cursor })}`, { signal });
export const searchUsers = (q, signal) => api(`/search${qs({ q, type: 'users', limit: 20 })}`, { signal });
export const getTrends = (signal, limit = 10) => api(`/search/trending${qs({ limit })}`, { signal }).then((r) => r.data.trends);
export const getSuggestions = (signal, limit = 5) => api(`/users/suggestions${qs({ limit })}`, { signal }).then((r) => r.data.users);
