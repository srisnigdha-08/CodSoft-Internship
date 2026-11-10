import { execSync } from 'node:child_process';
import 'dotenv/config';
import { assertSafeTestDatabase } from './testDatabase.js';

/** Applies the real schema, indexes and validators to the test database before the suite. */
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  assertSafeTestDatabase(url, process.env.DATABASE_URL);
  execSync('npx tsx prisma/setup.ts', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
