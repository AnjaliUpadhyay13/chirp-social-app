import { z } from 'zod';
import env from '../config/env.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// Length counted in characters (code points), so an emoji counts as 1.
export const createPostSchema = z.object({
  text: z
    .string({ required_error: 'Post text is required' })
    .trim()
    .min(1, 'Post cannot be empty')
    .refine((t) => Array.from(t).length <= env.POST_MAX_LENGTH, `Post must be at most ${env.POST_MAX_LENGTH} characters`),
}).strict();

export const idParamSchema = z.object({ id: objectId });

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: objectId.optional(),
});

// Home timeline: 'global' = everyone's posts, 'following' = you + people you follow (incl. their reposts)
export const feedQuerySchema = listQuerySchema.extend({ scope: z.enum(['global', 'following']).default('global') });
