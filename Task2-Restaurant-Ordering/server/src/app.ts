import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
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

// Secure CORS whitelist
const allowedOrigins = new Set<string>([
  config.frontendOrigin,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests with no origin (like mobile clients, curl, or Postman)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.has(origin)) {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'DineDesk Restaurant API',
    version: '1.0.0',
    environment: config.nodeEnv,
  });
});

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

// Centralized error handler
app.use(errorHandler);

export default app;
