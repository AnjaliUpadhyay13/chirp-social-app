import env from './env.js';

export const corsOptions = {
  origin(origin, cb) {
    // Allow non-browser clients (Postman, curl) that send no Origin header
    if (!origin || env.clientOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
};
