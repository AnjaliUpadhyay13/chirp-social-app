import { Router } from 'express';
import * as ctrl from '../controllers/notification.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { idParamSchema, listQuerySchema } from '../validators/post.validator.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate(listQuerySchema, 'query'), ctrl.list);
router.get('/unread-count', ctrl.unread);          // above '/:id'
router.patch('/read-all', ctrl.readAll);           // above '/:id'
router.patch('/:id/read', validate(idParamSchema, 'params'), ctrl.read);

export default router;
