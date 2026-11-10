import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
});

const WRITE_CONFLICT = 'P2034';
const MAX_ATTEMPTS = 5;

/** Reruns an operation that MongoDB aborted because a concurrent transaction won the race. */
export async function withWriteConflictRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const isConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === WRITE_CONFLICT;
      if (!isConflict || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * attempt + Math.random() * 30));
    }
  }
}

/** Prisma needs transactions, which MongoDB only offers on a replica set or sharded cluster. */
export async function assertTransactionsAvailable(client: PrismaClient): Promise<void> {
  const hello = await client.$runCommandRaw({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error(
      'MongoDB is running as a standalone server. Prisma requires a replica set; see Database Setup in the README.',
    );
  }
}
