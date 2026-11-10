import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { usesTransactions } from './utils/unitOfWork.js';

async function main(): Promise<void> {
  await connectDatabase();
  const server = createApp().listen(env.PORT, () => {
    const mode = usesTransactions() ? 'transactions' : 'atomic updates with compensating rollback';
    console.log(`API listening on port ${env.PORT} (checkout mode: ${mode})`);
  });

  const shutdown = () => {
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
