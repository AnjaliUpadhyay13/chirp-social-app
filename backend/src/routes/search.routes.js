import { Router } from 'express';
import * as ctrl from '../controllers/search.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import { searchQuerySchema, trendingQuerySchema } from '../validators/search.validator.js';

const router = Router();
router.use(requireAuth);

router.get('/trending', validate(trendingQuerySchema, 'query'), ctrl.trending); // above '/'
router.get('/', searchLimiter, validate(searchQuerySchema, 'query'), ctrl.run);

export default router;
