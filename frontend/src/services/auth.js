import { api } from './api.js';

export const registerUser = (payload) => api('/auth/register', { method: 'POST', body: payload }).then((r) => r.data.user);
export const loginUser = (payload) => api('/auth/login', { method: 'POST', body: payload }).then((r) => r.data.user);
export const logoutUser = () => api('/auth/logout', { method: 'POST' });
export const fetchMe = (signal) => api('/auth/me', { signal }).then((r) => r.data.user);
