import { z } from 'zod';

export const usernameParamSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, 'Invalid username'),
});

const chars = (s) => Array.from(s).length; // characters as users see them (emoji = 1)

// Only http(s) image URLs (no javascript:/data: URLs). Empty string clears the avatar.
const avatar = z.string().trim().max(500, 'Avatar URL is too long')
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Avatar must be an http(s) image URL');

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').refine((v) => chars(v) <= 50, 'Name must be at most 50 characters').optional(),
  bio: z.string().trim().refine((v) => chars(v) <= 160, 'Bio must be at most 160 characters').optional(),
  avatar: avatar.optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
// strict(): username, email, counters etc. cannot be changed through this endpoint
