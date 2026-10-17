import { Router } from 'express';
import * as ctrl from '../controllers/post.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { listQuerySchema } from '../validators/post.validator.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate(listQuerySchema, 'query'), ctrl.bookmarks); // only ever the caller's own bookmarks

export default router;
