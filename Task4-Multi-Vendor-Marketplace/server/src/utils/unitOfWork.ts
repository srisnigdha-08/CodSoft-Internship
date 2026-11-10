import mongoose, { type ClientSession } from 'mongoose';

export interface UnitOfWork {
  /** Pass to every write. Undefined when the server cannot run transactions. */
  session: ClientSession | undefined;
  /** Registers an undo step. Used only when no transaction is available. */
  onRollback(undo: () => Promise<unknown>): void;
}

let transactionsSupported = false;

/** Transactions need a replica set or mongos; a standalone server cannot run them. */
export async function detectTransactionSupport(): Promise<boolean> {
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  transactionsSupported = Boolean(hello.setName) || hello.msg === 'isdbgrid';
  return transactionsSupported;
}

export const usesTransactions = (): boolean => transactionsSupported;

/**
 * Runs a multi-document write as one unit. On a replica set it is a real
 * transaction. On a standalone server each registered undo step runs in
 * reverse order if the work throws, which restores state but, unlike a
 * transaction, is not isolated from concurrent readers while it runs.
 */
export async function runUnitOfWork<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T> {
  if (transactionsSupported) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(() => work({ session, onRollback: () => undefined }));
    } finally {
      await session.endSession();
    }
  }

  const undoSteps: Array<() => Promise<unknown>> = [];
  try {
    return await work({ session: undefined, onRollback: (undo) => undoSteps.push(undo) });
  } catch (error) {
    for (const undo of undoSteps.reverse()) {
      try {
        await undo();
      } catch (undoError) {
        console.error('Rollback step failed', undoError);
      }
    }
    throw error;
  }
}
