import type { PrismaClient } from '@prisma/client';

const INT_MAX = 2147483647;

const endNotBeforeStart = { $lte: ['$startDate', { $ifNull: ['$endDate', '$startDate'] }] };

/** MongoDB equivalents of the integrity rules Prisma cannot express in the schema file. */
const COLLECTION_RULES = {
  Job: {
    $and: [
      { $gte: [{ $ifNull: ['$salaryMin', 0] }, 0] },
      { $gte: [{ $ifNull: ['$salaryMax', 0] }, 0] },
      { $lte: [{ $ifNull: ['$salaryMin', 0] }, { $ifNull: ['$salaryMax', INT_MAX] }] },
    ],
  },
  Education: endNotBeforeStart,
  Experience: {
    $and: [
      endNotBeforeStart,
      {
        $or: [
          { $ne: ['$currentlyWorking', true] },
          { $eq: [{ $ifNull: ['$endDate', null] }, null] },
        ],
      },
    ],
  },
};

export async function applyCollectionValidators(client: PrismaClient): Promise<void> {
  for (const [collection, rule] of Object.entries(COLLECTION_RULES)) {
    await client.$runCommandRaw({
      collMod: collection,
      validator: { $expr: rule },
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
}
