import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { notFound } from '../utils/apiError.js';
import { validateResumeFile } from '../utils/resumeFile.js';

const resumeSummarySelect = {
  id: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

export interface StoredResume {
  originalName: string;
  storedName: string;
  mimeType: string;
}

async function removeStoredFile(storedName: string): Promise<void> {
  await unlink(path.join(env.uploadDir, path.basename(storedName))).catch(() => undefined);
}

/** Resumes referenced by an application are kept so employers still see what was submitted. */
async function discardResumeIfUnused(resumeId: string): Promise<void> {
  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    select: {
      storedName: true,
      _count: { select: { applications: true } },
      currentFor: { select: { id: true } },
    },
  });
  if (!resume || resume._count.applications > 0 || resume.currentFor.length > 0) return;
  await prisma.resume.delete({ where: { id: resumeId } });
  await removeStoredFile(resume.storedName);
}

export async function saveResume(profileId: string, file: Express.Multer.File) {
  const validated = validateResumeFile(file);
  const storedName = `${randomUUID()}${validated.extension}`;
  await mkdir(env.uploadDir, { recursive: true });
  await writeFile(path.join(env.uploadDir, storedName), file.buffer, { flag: 'wx' });

  try {
    const { resume, previousResumeId } = await prisma.$transaction(async (tx) => {
      const profile = await tx.jobSeekerProfile.findUniqueOrThrow({
        where: { id: profileId },
        select: { currentResumeId: true },
      });
      const created = await tx.resume.create({
        data: {
          profileId,
          originalName: validated.originalName,
          storedName,
          mimeType: validated.mimeType,
          sizeBytes: file.size,
        },
        select: resumeSummarySelect,
      });
      await tx.jobSeekerProfile.update({
        where: { id: profileId },
        data: { currentResumeId: created.id },
      });
      return { resume: created, previousResumeId: profile.currentResumeId };
    });
    if (previousResumeId) await discardResumeIfUnused(previousResumeId);
    return resume;
  } catch (error) {
    await removeStoredFile(storedName);
    throw error;
  }
}

export async function getCurrentResume(profileId: string) {
  const profile = await prisma.jobSeekerProfile.findUniqueOrThrow({
    where: { id: profileId },
    select: { currentResume: { select: resumeSummarySelect } },
  });
  return profile.currentResume;
}

export async function getCurrentResumeFile(profileId: string): Promise<StoredResume> {
  const profile = await prisma.jobSeekerProfile.findUniqueOrThrow({
    where: { id: profileId },
    select: {
      currentResume: { select: { originalName: true, storedName: true, mimeType: true } },
    },
  });
  if (!profile.currentResume) throw notFound('No resume has been uploaded');
  return profile.currentResume;
}

export async function deleteCurrentResume(profileId: string): Promise<void> {
  const profile = await prisma.jobSeekerProfile.findUniqueOrThrow({
    where: { id: profileId },
    select: { currentResumeId: true },
  });
  if (!profile.currentResumeId) throw notFound('No resume has been uploaded');
  await prisma.jobSeekerProfile.update({
    where: { id: profileId },
    data: { currentResumeId: null },
  });
  await discardResumeIfUnused(profile.currentResumeId);
}
