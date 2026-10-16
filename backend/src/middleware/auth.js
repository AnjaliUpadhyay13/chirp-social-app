import env from '../config/env.js';
import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

async function loadUser(req) {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.sub) return null;
  return User.findById(payload.sub); // re-checked in DB: deleted users lose access immediately
}

// Blocks the request unless a valid session cookie maps to an existing user.
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req);
  if (!user) throw ApiError.unauthorized();
  req.user = user;
  next();
});

// Attaches req.user when logged in, but lets anonymous requests through.
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = (await loadUser(req)) || null;
  next();
});
