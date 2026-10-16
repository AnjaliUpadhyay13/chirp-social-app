import { ZodError } from 'zod';
import mongoose from 'mongoose';
import env from '../config/env.js';

// Normalises every error into the standard envelope.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request data';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid data';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'INVALID_ID';
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `${field} already exists`;
  } else if (err.message?.startsWith('Origin ') && err.message.includes('not allowed by CORS')) {
    status = 403;
    code = 'CORS_BLOCKED';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON body';
  }

  if (status >= 500) {
    console.error(err);
    if (env.isProd) message = 'Something went wrong';
  }

  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  });
}
