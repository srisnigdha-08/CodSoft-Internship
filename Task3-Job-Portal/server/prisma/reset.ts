/**
 * Erases the database in DATABASE_URL, then recreates and reseeds it.
 * Usage: npm run db:reset -- --confirm <database name>
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { databaseNameFrom } from '../src/config/databaseName.js';

function assertResetAllowed(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset a database while NODE_ENV=production.');
  }
  const name = databaseNameFrom(process.env.DATABASE_URL ?? '');
  if (!name) throw new Error('DATABASE_URL must be a MongoDB URI that names a database.');
  const confirmIndex = process.argv.indexOf('--confirm');
  const confirmed = confirmIndex === -1 ? undefined : process.argv[confirmIndex + 1];
  if (confirmed !== name) {
    throw new Error(`This erases "${name}". Rerun with: npm run db:reset -- --confirm ${name}`);
  }
}

async function main(): Promise<void> {
  assertResetAllowed();
  const client = new PrismaClient();
  try {
    await client.$runCommandRaw({ dropDatabase: 1 });
  } finally {
    await client.$disconnect();
  }
  execSync('npx tsx prisma/setup.ts', { stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Database reset failed');
  process.exitCode = 1;
});
