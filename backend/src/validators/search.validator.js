import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string({ required_error: 'Search text is required' }).trim().min(1, 'Search text is required').max(100, 'Search text is too long'),
  type: z.enum(['posts', 'users']).default('posts'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id').optional(),
});

export const trendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
