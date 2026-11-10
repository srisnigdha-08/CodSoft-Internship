import mongoose, { ClientSession } from 'mongoose';
import './models';

let transactionsAvailable: boolean | undefined;

/** Connects and waits until every index, including the double-booking guard, exists. */
export async function connectDatabase(uri: string): Promise<void> {
  transactionsAvailable = undefined;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export async function pingDatabase(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      return false;
    }
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

/** Multi-document transactions require a replica set or sharded cluster. */
export async function supportsTransactions(): Promise<boolean> {
  if (transactionsAvailable === undefined) {
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    transactionsAvailable = Boolean(hello.setName) || hello.msg === 'isdbgrid';
  }
  return transactionsAvailable;
}

/**
 * Runs related writes as one unit.
 * On a replica set this is a real transaction, and `work` may be retried, so it must build its
 * documents inside the callback. A standalone server cannot run transactions, so `work` runs
 * without one and `compensate` undoes any partial writes if it fails.
 */
export async function runAtomic<T>(
  work: (session?: ClientSession) => Promise<T>,
  compensate?: () => Promise<void>
): Promise<T> {
  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result!;
    } finally {
      await session.endSession();
    }
  }

  try {
    return await work(undefined);
  } catch (err) {
    if (compensate) {
      await compensate().catch((cleanupError) => console.error('[Compensation failed]', cleanupError));
    }
    throw err;
  }
}
