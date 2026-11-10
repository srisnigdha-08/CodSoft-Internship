import path from 'path';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../db';
import { seedDatabase } from '../seed/seed';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required to seed the database (see server/.env.example).');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo accounts when NODE_ENV=production.');
  }

  await connectDatabase(uri);
  console.log('Seeding DineDesk database...');
  await seedDatabase(console.log);
  console.log('Seeding completed successfully!');
}

main()
  .catch((err) => {
    console.error('Seeding error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
