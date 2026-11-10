import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { allModels } from '../models/index.js';

async function main(): Promise<void> {
  await connectDatabase();
  for (const model of allModels) {
    await model.syncIndexes();
    console.log(`Indexes synced: ${model.collection.name}`);
  }
  await disconnectDatabase();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
