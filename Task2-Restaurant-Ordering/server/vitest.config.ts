import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: path.resolve(__dirname, '.env') });

// The suite writes and deletes rows, so it must never touch the development database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required to run the tests. Point it at a separate database (see server/.env.example).');
}

const databaseIdentity = (url: string) => {
  const { hostname, port, pathname } = new URL(url);
  return `${hostname}:${port || '5432'}${pathname}`;
};

if (!/test/i.test(new URL(testDatabaseUrl).pathname)) {
  throw new Error('Refusing to run: the TEST_DATABASE_URL database name must contain "test".');
}
if (process.env.DATABASE_URL && databaseIdentity(process.env.DATABASE_URL) === databaseIdentity(testDatabaseUrl)) {
  throw new Error('Refusing to run: TEST_DATABASE_URL points at the same database as DATABASE_URL.');
}

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/global-setup.ts',
    env: {
      NODE_ENV: 'test',
      PORT: '5050',
      DATABASE_URL: testDatabaseUrl,
      // Fixed values used only inside the test process
      JWT_SECRET: 'test-only-jwt-secret-not-used-outside-automated-tests',
      COOKIE_SECRET: 'test-only-cookie-secret-not-used-outside-automated-tests',
      FRONTEND_ORIGIN: 'http://localhost:3000',
    },
  },
});
