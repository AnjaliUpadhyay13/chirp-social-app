import { Router } from 'express';
import * as ctrl from '../controllers/post.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { createPostSchema, idParamSchema, listQuerySchema, feedQuerySchema } from '../validators/post.validator.js';

const router = Router();

router.use(requireAuth); // every post endpoint needs a logged-in user

router.post('/', writeLimiter, validate(createPostSchema), ctrl.create);
router.get('/feed', validate(feedQuerySchema, 'query'), ctrl.feed); // must stay above '/:id'

router.get('/:id', validate(idParamSchema, 'params'), ctrl.show);
router.delete('/:id', validate(idParamSchema, 'params'), ctrl.remove);

router.get('/:id/replies', validate(idParamSchema, 'params'), validate(listQuerySchema, 'query'), ctrl.replies);
router.post('/:id/replies', writeLimiter, validate(idParamSchema, 'params'), validate(createPostSchema), ctrl.reply);

router.post('/:id/like', validate(idParamSchema, 'params'), ctrl.like);
router.delete('/:id/like', validate(idParamSchema, 'params'), ctrl.unlike);
router.post('/:id/bookmark', validate(idParamSchema, 'params'), ctrl.bookmark);
router.delete('/:id/bookmark', validate(idParamSchema, 'params'), ctrl.unbookmark);
router.post('/:id/repost', validate(idParamSchema, 'params'), ctrl.repost);
router.delete('/:id/repost', validate(idParamSchema, 'params'), ctrl.unrepost);

export default router;
