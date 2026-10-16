import argon2 from 'argon2';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from '../utils/jwt.js';

const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }; // OWASP minimum profile

// Used to burn equal time when the account doesn't exist (reduces user-enumeration via timing)
const DUMMY_HASH = await argon2.hash('dummy-password-for-timing', ARGON_OPTS);

export async function register({ name, username, email, password }) {
  // Friendly pre-checks give field-specific errors; the unique indexes remain the real guard against races.
  const [byEmail, byUsername] = await Promise.all([
    User.exists({ email }),
    User.exists({ username }),
  ]);
  const details = [];
  if (byEmail) details.push({ field: 'email', message: 'An account with this email already exists' });
  if (byUsername) details.push({ field: 'username', message: 'This username is taken' });
  if (details.length) throw ApiError.conflict('Account already exists', details);

  const passwordHash = await argon2.hash(password, ARGON_OPTS);
  const user = await User.create({ name, username, email, passwordHash });
  return { user, token: signToken(user.id) };
}

export async function login({ identifier, password }) {
  const query = identifier.includes('@') ? { email: identifier } : { username: identifier };
  const user = await User.findOne(query).select('+passwordHash');

  const valid = user
    ? await argon2.verify(user.passwordHash, password)
    : (await argon2.verify(DUMMY_HASH, password), false);

  // Same message for "no such user" and "wrong password"
  if (!valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email/username or password');

  return { user, token: signToken(user.id) };
}
