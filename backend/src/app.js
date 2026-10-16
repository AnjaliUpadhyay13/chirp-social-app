import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import env from './config/env.js';
import { corsOptions } from './config/cors.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $ and . operators from body/query/params (NoSQL injection)
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.use('/api/v1', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
