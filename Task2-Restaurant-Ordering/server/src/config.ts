import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5050', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'dinedesk_fallback_secret_for_dev_mode_only',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSecret: process.env.COOKIE_SECRET || 'dinedesk_cookie_secret',
};
