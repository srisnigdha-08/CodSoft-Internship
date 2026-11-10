import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { pingDatabase } from './db';
import { errorHandler } from './middleware/error';
import { ForbiddenError } from './utils/errors';

// Routes
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import categoriesRoutes from './routes/categories.routes';
import ordersRoutes from './routes/orders.routes';
import kitchenRoutes from './routes/kitchen.routes';
import reservationsRoutes from './routes/reservations.routes';
import tablesRoutes from './routes/tables.routes';
import paymentsRoutes from './routes/payments.routes';
import adminRoutes from './routes/admin.routes';

export const app = express();

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests with no origin (like mobile clients, curl, or Postman)
      if (!origin) {
        return callback(null, true);
      }
      // Only the single configured frontend origin may make credentialed browser requests
      if (origin === config.frontendOrigin) {
        return callback(null, true);
      }
      return callback(new ForbiddenError(`Origin '${origin}' not allowed by CORS policy.`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.cookieSecret));

// Health check endpoints: they verify the database connection and never reveal connection details
async function healthCheck(req: express.Request, res: express.Response) {
  const connected = await pingDatabase();
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'error',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    service: 'DineDesk Restaurant API',
    version: '1.0.0',
    environment: config.nodeEnv,
  });
}

app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/menu', menuRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/kitchen', kitchenRoutes);
app.use('/api/v1/reservations', reservationsRoutes);
app.use('/api/v1/tables', tablesRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/admin', adminRoutes);

// Unknown API routes return JSON, matching every other API response
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

// Centralized error handler
app.use(errorHandler);

export default app;
