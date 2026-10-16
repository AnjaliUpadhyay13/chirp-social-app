import { api } from './api.js';

const qs = (params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const getProfile = (username, signal) => api(`/users/${username}`, { signal }).then((r) => r.data.user);
export const updateProfile = (patch) => api('/users/me', { method: 'PATCH', body: patch }).then((r) => r.data.user);
export const setFollow = (username, on) => api(`/users/${username}/follow`, { method: on ? 'POST' : 'DELETE' }).then((r) => r.data);

// Page fetchers return the full envelope { data, meta: { nextCursor } }
export const getUserPosts = (username, cursor, signal) => api(`/users/${username}/posts${qs({ limit: 20, cursor })}`, { signal });
export const getUserReplies = (username, cursor, signal) => api(`/users/${username}/replies${qs({ limit: 20, cursor })}`, { signal });
export const getFollowers = (username, cursor, signal) => api(`/users/${username}/followers${qs({ limit: 20, cursor })}`, { signal });
export const getFollowing = (username, cursor, signal) => api(`/users/${username}/following${qs({ limit: 20, cursor })}`, { signal });
