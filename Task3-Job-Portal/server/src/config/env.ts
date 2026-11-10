import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';
import { databaseNameFrom } from './databaseName.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  DATABASE_URL: z.string().refine((uri) => databaseNameFrom(uri) !== null),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_HOURS: z.coerce.number().int().min(1).max(720).default(24),
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  UPLOAD_DIR: z.string().min(1).default('uploads/resumes'),
  MAX_RESUME_SIZE_MB: z.coerce.number().int().min(1).max(20).default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Only variable names are reported so that a misconfigured value is never logged.
  const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
  throw new Error(`Invalid environment configuration: ${names.join(', ')}`);
}

const values = parsed.data;

if (values.NODE_ENV === 'production') {
  if (values.JWT_SECRET.startsWith('replace-with')) {
    throw new Error('JWT_SECRET still contains the placeholder value');
  }
  if (values.BCRYPT_ROUNDS < 10) {
    throw new Error('BCRYPT_ROUNDS must be at least 10 in production');
  }
}

export const env = {
  ...values,
  isProduction: values.NODE_ENV === 'production',
  clientOrigins: values.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  uploadDir: path.resolve(process.cwd(), values.UPLOAD_DIR),
  maxResumeBytes: values.MAX_RESUME_SIZE_MB * 1024 * 1024,
};
