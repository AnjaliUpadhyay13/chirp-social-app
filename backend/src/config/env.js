import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5001),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/social_app'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default('dev-only-secret-change-me-dev-only-secret'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('sid'),
  POST_MAX_LENGTH: z.coerce.number().int().min(1).max(5000).default(280),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('dev-only')) {
  console.error('Refusing to start in production with the default JWT_SECRET.');
  process.exit(1);
}

export default Object.freeze({
  ...env,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  clientOrigins: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
});
