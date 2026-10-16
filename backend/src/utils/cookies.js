import jwt from 'jsonwebtoken';
import env from '../config/env.js';

const baseOptions = () => ({
  httpOnly: true,                 // not readable from JS => XSS can't steal the token
  secure: env.isProd,             // HTTPS only in production
  sameSite: env.isProd ? 'strict' : 'lax',
  path: '/',
});

export function setAuthCookie(res, token) {
  const { exp } = jwt.decode(token);
  res.cookie(env.COOKIE_NAME, token, { ...baseOptions(), maxAge: exp * 1000 - Date.now() });
}

export const clearAuthCookie = (res) => res.clearCookie(env.COOKIE_NAME, baseOptions());
