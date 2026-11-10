import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: path.resolve(__dirname, '.env') });

// The suite clears its database before running, so it must never touch the development database.
const testUri = process.env.MONGODB_TEST_URI;
if (!testUri) {
  throw new Error('MONGODB_TEST_URI is required to run the tests. Point it at a separate database (see server/.env.example).');
}

const databaseIdentity = (uri: string) => {
  const { host, pathname } = new URL(uri);
  return `${host}${pathname}`;
};

if (!/test/i.test(new URL(testUri).pathname)) {
  throw new Error('Refusing to run: the MONGODB_TEST_URI database name must contain "test".');
}
if (process.env.MONGODB_URI && databaseIdentity(process.env.MONGODB_URI) === databaseIdentity(testUri)) {
  throw new Error('Refusing to run: MONGODB_TEST_URI points at the same database as MONGODB_URI.');
}

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/global-setup.ts',
    testTimeout: 20000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      PORT: '5050',
      MONGODB_URI: testUri,
      // Fixed values used only inside the test process
      JWT_SECRET: 'test-only-jwt-secret-not-used-outside-automated-tests',
      COOKIE_SECRET: 'test-only-cookie-secret-not-used-outside-automated-tests',
      FRONTEND_ORIGIN: 'http://localhost:3000',
    },
  },
});
