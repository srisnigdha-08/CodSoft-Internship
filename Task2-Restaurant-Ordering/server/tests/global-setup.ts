import path from 'path';
import { execSync } from 'child_process';

// Applies migrations and the idempotent seed to the isolated test database only.
// vitest.config.ts has already verified that TEST_DATABASE_URL is safe to use.
export default function setup() {
  const options = {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe' as const,
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, NODE_ENV: 'test' },
  };

  execSync('npx prisma migrate deploy', options);
  execSync('npx tsx prisma/seed.ts', options);
}
