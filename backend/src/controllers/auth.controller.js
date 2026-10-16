import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { setAuthCookie, clearAuthCookie } from '../utils/cookies.js';

export const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.register(req.body);
  setAuthCookie(res, token);
  created(res, { user });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  setAuthCookie(res, token);
  ok(res, { user });
});

export const logout = (_req, res) => {
  clearAuthCookie(res);
  ok(res, { loggedOut: true });
};

export const me = (req, res) => ok(res, { user: req.user });
