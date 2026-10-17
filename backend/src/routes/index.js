import { Router } from 'express';
import env from '../config/env.js';
import { dbState } from '../config/db.js';
import { ok } from '../utils/response.js';
import authRoutes from './auth.routes.js';
import postRoutes from './post.routes.js';
import userRoutes from './user.routes.js';
import bookmarkRoutes from './bookmark.routes.js';
import notificationRoutes from './notification.routes.js';
import searchRoutes from './search.routes.js';

const router = Router();

router.get('/health', (_req, res) =>
  ok(res, { status: 'ok', uptime: Math.round(process.uptime()), database: dbState(), time: new Date().toISOString() }),
);

// Public runtime settings the frontend needs (e.g. character limit)
router.get('/config', (_req, res) => ok(res, { postMaxLength: env.POST_MAX_LENGTH }));

// Feature routers are mounted here as phases land:
router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.use('/users', userRoutes);
router.use('/bookmarks', bookmarkRoutes);
router.use('/notifications', notificationRoutes);
router.use('/search', searchRoutes);

export default router;
