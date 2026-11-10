import 'dotenv/config';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { assertSafeTestDatabase } from './tests/testDatabase.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';
assertSafeTestDatabase(testDatabaseUrl, process.env.DATABASE_URL);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // Every file shares the one test database, so files must not overlap.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: 'test-only-secret-that-is-long-enough-to-pass',
      BCRYPT_ROUNDS: '4',
      AUTH_RATE_LIMIT_MAX: '100000',
      CLIENT_ORIGIN: 'http://localhost:5173',
      UPLOAD_DIR: path.join(tmpdir(), 'job-portal-test-uploads'),
      MAX_RESUME_SIZE_MB: '1',
    },
  },
});
