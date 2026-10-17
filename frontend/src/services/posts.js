import { api } from './api.js';

const qs = (params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  const s = q.toString();
  return s ? `?${s}` : '';
};

// Page fetchers return the full envelope { data: { posts }, meta: { nextCursor } }
export const getFeed = (cursor, signal, scope) =>
  api(`/posts/feed${qs({ limit: 20, cursor, scope: scope === 'following' ? 'following' : undefined })}`, { signal });
export const getReplies = (id, cursor, signal) => api(`/posts/${id}/replies${qs({ limit: 20, cursor })}`, { signal });

export const getPost = (id, signal) => api(`/posts/${id}`, { signal }).then((r) => r.data); // { post, ancestors }
export const createPost = (text) => api('/posts', { method: 'POST', body: { text } }).then((r) => r.data.post);
export const createReply = (id, text) => api(`/posts/${id}/replies`, { method: 'POST', body: { text } }).then((r) => r.data.post);
export const deletePost = (id) => api(`/posts/${id}`, { method: 'DELETE' }).then((r) => r.data);
export const setLike = (id, on) => api(`/posts/${id}/like`, { method: on ? 'POST' : 'DELETE' }).then((r) => r.data);
export const setBookmark = (id, on) => api(`/posts/${id}/bookmark`, { method: on ? 'POST' : 'DELETE' }).then((r) => r.data);
export const getBookmarks = (cursor, signal) => api(`/bookmarks${qs({ limit: 20, cursor })}`, { signal });
export const setRepost = (id, on) => api(`/posts/${id}/repost`, { method: on ? 'POST' : 'DELETE' }).then((r) => r.data);
