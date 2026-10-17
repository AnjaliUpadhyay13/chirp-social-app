import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

const handler = (_req, res) =>
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
  });

const base = { standardHeaders: true, legacyHeaders: false, handler, skip: () => env.isTest };

// General limiter for the whole API
export const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 500 });

// Stricter limiter for login/register (applied in Phase 2)
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 20 });

// Throttles content creation (posts and replies) per IP
export const writeLimiter = rateLimit({ ...base, windowMs: 60 * 1000, limit: 30 });

// Search hits the database with substring matches, so keep it modest per IP
export const searchLimiter = rateLimit({ ...base, windowMs: 60 * 1000, limit: 60 });
