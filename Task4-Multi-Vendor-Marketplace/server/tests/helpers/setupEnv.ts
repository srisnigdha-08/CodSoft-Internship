import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

// Runs before any application module loads. MONGODB_TEST_URI must come from the
// environment or server/.env; the development database is never configured here.
dotenv.config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_ORIGINS = 'http://localhost:5184';
process.env.BCRYPT_ROUNDS = '4';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
