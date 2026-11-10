import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';

export const normalizeSkill = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

async function findOrCreateSkill(normalizedName: string, name: string): Promise<string> {
  const existing = await prisma.skill.findUnique({
    where: { normalizedName },
    select: { id: true },
  });
  if (existing) return existing.id;
  try {
    const created = await prisma.skill.create({
      data: { name, normalizedName },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    // Another request created the same skill first, so its row is the canonical one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await prisma.skill.findUniqueOrThrow({
        where: { normalizedName },
        select: { id: true },
      });
      return winner.id;
    }
    throw error;
  }
}

/**
 * Finds or creates each skill so that one canonical row exists per case-insensitive name.
 * Runs outside transactions because a duplicate key error would abort a MongoDB transaction.
 */
export async function resolveSkillIds(names: string[]): Promise<string[]> {
  const unique = new Map(names.map((name) => [normalizeSkill(name), name.trim().replace(/\s+/g, ' ')]));
  return Promise.all([...unique].map(([normalized, name]) => findOrCreateSkill(normalized, name)));
}

export const listSkills = (query: string | undefined) =>
  prisma.skill.findMany({
    where: query ? { name: { contains: query, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
    take: 50,
    select: { id: true, name: true },
  });
