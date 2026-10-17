import { z } from 'zod';

// Usernames that would collide with app routes (/explore, /:username ...) or look official
const RESERVED = new Set([
  'admin', 'administrator', 'api', 'app', 'login', 'logout', 'register', 'signup', 'home', 'explore',
  'notifications', 'bookmarks', 'profile', 'settings', 'search', 'compose', 'support', 'help', 'about',
  'root', 'system', 'chirp', 'null', 'undefined', 'me', 'i', 'u', 'post', 'posts', 'user', 'users',
  'followers', 'following', 'suggestions', 'trending', 'static', 'assets', 'public', 'favicon', 'privacy', 'terms',
]);

const username = z
  .string({ required_error: 'Username is required' })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'Username must be 3-20 characters: letters, numbers, underscore')
  .refine((v) => !RESERVED.has(v), 'This username is not available');

const email = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254)
  .email('Enter a valid email address');

const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
  username,
  email,
  password,
}).strict();

// `identifier` = email or username. Strings only => operator objects like {"$ne":null} are rejected.
export const loginSchema = z.object({
  identifier: z.string({ required_error: 'Email or username is required' }).trim().toLowerCase().min(1, 'Email or username is required').max(254),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(128),
}).strict();
