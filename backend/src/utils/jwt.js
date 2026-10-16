import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const signToken = (userId) =>
  jwt.sign({}, env.JWT_SECRET, { subject: String(userId), expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' });

// Returns the payload or null (expired / tampered / wrong algorithm)
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}
