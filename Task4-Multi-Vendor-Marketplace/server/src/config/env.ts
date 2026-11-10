import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4004),
  MONGODB_URI: z.string().min(1).optional(),
  MONGODB_TEST_URI: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN_HOURS: z.coerce.number().positive().default(24),
  CLIENT_ORIGINS: z.string().min(1, 'CLIENT_ORIGINS must list at least one origin'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  clientOrigins: parsed.data.CLIENT_ORIGINS.split(',').map((origin) => origin.trim()),
};

export const TEST_DATABASE_NAME = 'codsoft_marketplace_test';

/** Extracts the database name from a MongoDB connection string. */
export function databaseNameOf(uri: string): string | null {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolves the connection string for the current environment. The test
 * environment can only ever reach the dedicated test database.
 */
export function resolveDatabaseUri(): string {
  if (env.NODE_ENV === 'test') {
    if (!env.MONGODB_TEST_URI) throw new Error('MONGODB_TEST_URI is required to run tests');
    const name = databaseNameOf(env.MONGODB_TEST_URI);
    if (name !== TEST_DATABASE_NAME) {
      throw new Error(`Refusing to run tests against "${name}". Expected "${TEST_DATABASE_NAME}".`);
    }
    return env.MONGODB_TEST_URI;
  }
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  return env.MONGODB_URI;
}
