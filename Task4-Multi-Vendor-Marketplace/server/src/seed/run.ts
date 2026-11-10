import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { databaseNameOf, env, resolveDatabaseUri } from '../config/env.js';
import { runSeed } from './seed.js';

async function main(): Promise<void> {
  if (env.isProduction) {
    throw new Error('Refusing to seed demo data while NODE_ENV=production');
  }
  const database = databaseNameOf(resolveDatabaseUri());
  if (database !== 'codsoft_marketplace') {
    throw new Error(`Refusing to seed "${database}". Expected "codsoft_marketplace".`);
  }

  await connectDatabase();
  console.log(`Seeded ${database}:`, await runSeed());
  await disconnectDatabase();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
