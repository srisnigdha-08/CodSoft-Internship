import { createApp } from './app.js';
import { env } from './config/env.js';
import { assertTransactionsAvailable, prisma } from './db/prisma.js';
import { expireOverdueJobs } from './services/job.service.js';

const EXPIRY_SWEEP_MS = 15 * 60 * 1000;

async function main(): Promise<void> {
  await prisma.$connect();
  await assertTransactionsAvailable(prisma);
  await expireOverdueJobs();
  const sweep = setInterval(() => {
    expireOverdueJobs().catch((error: unknown) => console.error('Job expiry sweep failed', error));
  }, EXPIRY_SWEEP_MS);

  const server = createApp().listen(env.PORT, () => {
    console.log(`Job Portal API listening on port ${env.PORT}`);
  });

  const shutdown = () => {
    clearInterval(sweep);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error('Failed to start the API', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
