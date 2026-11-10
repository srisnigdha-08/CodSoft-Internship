/** Creates collections and indexes from schema.prisma, then applies the collection validators. */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { assertTransactionsAvailable } from '../src/db/prisma.js';
import { applyCollectionValidators } from './validators.js';

async function main(): Promise<void> {
  const client = new PrismaClient();
  try {
    await assertTransactionsAvailable(client);
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    await applyCollectionValidators(client);
    console.log('MongoDB indexes and validators are in place.');
  } finally {
    await client.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Database setup failed');
  process.exitCode = 1;
});
