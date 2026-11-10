import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { databaseStatus } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { adminRouter } from './routes/admin.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { cartRouter } from './routes/cart.routes.js';
import { categoriesRouter } from './routes/categories.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { productsRouter } from './routes/products.routes.js';
import { reviewsRouter } from './routes/reviews.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { vendorsRouter } from './routes/vendors.routes.js';
import { forbidden } from './utils/AppError.js';

export interface AppOptions {
  authRateLimitMax?: number;
}

/** Blocks requests from browsers on unlisted origins, including simple POSTs CORS would not stop. */
const originGuard: RequestHandler = (req, _res, next) => {
  const origin = req.headers.origin;
  if (origin && !env.clientOrigins.includes(origin)) throw forbidden('Origin not allowed');
  next();
};

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(originGuard);
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    const database = databaseStatus();
    const healthy = database === 'connected';
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', database });
  });

  app.use('/api/auth', authRoutes(options.authRateLimitMax ?? env.AUTH_RATE_LIMIT_MAX));
  app.use('/api/users', usersRouter);
  app.use('/api/vendors', vendorsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
