import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/db';
import { seedDatabase } from '../src/seed/seed';

// Starts every run from a known state. vitest.config.ts has already verified that
// MONGODB_TEST_URI is a separate test database, so clearing it here is safe.
export default async function setup() {
  await mongoose.connect(process.env.MONGODB_TEST_URI!, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  await connectDatabase(process.env.MONGODB_TEST_URI!);
  await seedDatabase();
  await disconnectDatabase();
}
