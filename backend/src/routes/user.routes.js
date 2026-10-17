import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { usernameParamSchema, updateProfileSchema } from '../validators/user.validator.js';
import { listQuerySchema } from '../validators/post.validator.js';

const router = Router();
const byName = validate(usernameParamSchema, 'params');
const paged = validate(listQuerySchema, 'query');

router.use(requireAuth);

router.patch('/me', validate(updateProfileSchema), ctrl.updateMe); // must stay above '/:username'

router.get('/suggestions', paged, ctrl.suggestions); // must stay above '/:username'

router.get('/:username', byName, ctrl.profile);
router.get('/:username/posts', byName, paged, ctrl.posts);
router.get('/:username/replies', byName, paged, ctrl.replies);
router.get('/:username/followers', byName, paged, ctrl.followers);
router.get('/:username/following', byName, paged, ctrl.following);
router.post('/:username/follow', byName, ctrl.follow);
router.delete('/:username/follow', byName, ctrl.unfollow);

export default router;
