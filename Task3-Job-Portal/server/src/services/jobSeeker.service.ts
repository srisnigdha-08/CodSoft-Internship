import { ApplicationStatus } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { notFound } from '../utils/apiError.js';
import type {
  EducationInput,
  ExperienceInput,
  JobSeekerProfileInput,
} from '../validation/profile.validation.js';
import { resolveSkillIds } from './skill.service.js';

export async function getSeekerProfileId(userId: string): Promise<string> {
  const profile = await prisma.jobSeekerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw notFound('Job seeker profile not found');
  return profile.id;
}

export async function getFullProfile(userId: string) {
  const profile = await prisma.jobSeekerProfile.findUniqueOrThrow({
    where: { userId },
    include: {
      user: { select: { name: true, email: true } },
      skills: { include: { skill: { select: { name: true } } } },
      education: { orderBy: { startDate: 'desc' } },
      experience: { orderBy: { startDate: 'desc' } },
      currentResume: {
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
    },
  });
  const { user, skills, currentResume, currentResumeId: _currentResumeId, ...rest } = profile;
  return {
    ...rest,
    name: user.name,
    email: user.email,
    skills: skills.map((entry) => entry.skill.name).sort((a, b) => a.localeCompare(b)),
    resume: currentResume,
  };
}

export async function updateProfile(userId: string, input: JobSeekerProfileInput) {
  const { name, ...profile } = input;
  await prisma.user.update({
    where: { id: userId },
    data: { name, jobSeekerProfile: { update: profile } },
  });
  return getFullProfile(userId);
}

export async function replaceSkills(userId: string, names: string[]) {
  const profileId = await getSeekerProfileId(userId);
  const skillIds = await resolveSkillIds(names);
  await prisma.$transaction(async (tx) => {
    await tx.jobSeekerSkill.deleteMany({ where: { profileId } });
    if (skillIds.length > 0) {
      await tx.jobSeekerSkill.createMany({
        data: skillIds.map((skillId) => ({ profileId, skillId })),
      });
    }
  });
  return getFullProfile(userId);
}

export async function addEducation(userId: string, input: EducationInput) {
  const profileId = await getSeekerProfileId(userId);
  return prisma.education.create({ data: { ...input, profileId } });
}

// Each write is scoped by profileId, so another candidate's record simply is not found.
export async function updateEducation(userId: string, id: string, input: EducationInput) {
  const profileId = await getSeekerProfileId(userId);
  const { count } = await prisma.education.updateMany({
    where: { id, profileId },
    data: { ...input, endDate: input.endDate ?? null, grade: input.grade ?? null },
  });
  if (count === 0) throw notFound('Education entry not found');
  return prisma.education.findUniqueOrThrow({ where: { id } });
}

export async function deleteEducation(userId: string, id: string) {
  const profileId = await getSeekerProfileId(userId);
  const { count } = await prisma.education.deleteMany({ where: { id, profileId } });
  if (count === 0) throw notFound('Education entry not found');
}

export async function addExperience(userId: string, input: ExperienceInput) {
  const profileId = await getSeekerProfileId(userId);
  return prisma.experience.create({ data: { ...input, profileId } });
}

export async function updateExperience(userId: string, id: string, input: ExperienceInput) {
  const profileId = await getSeekerProfileId(userId);
  const { count } = await prisma.experience.updateMany({
    where: { id, profileId },
    data: { ...input, endDate: input.endDate ?? null, description: input.description ?? null },
  });
  if (count === 0) throw notFound('Experience entry not found');
  return prisma.experience.findUniqueOrThrow({ where: { id } });
}

export async function deleteExperience(userId: string, id: string) {
  const profileId = await getSeekerProfileId(userId);
  const { count } = await prisma.experience.deleteMany({ where: { id, profileId } });
  if (count === 0) throw notFound('Experience entry not found');
}

export async function getDashboard(userId: string) {
  const profile = await getFullProfile(userId);
  const [grouped, recent] = await Promise.all([
    prisma.application.groupBy({
      by: ['status'],
      where: { candidateId: profile.id },
      _count: { _all: true },
    }),
    prisma.application.findMany({
      where: { candidateId: profile.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        job: { select: { id: true, title: true, company: { select: { name: true } } } },
      },
    }),
  ]);
  const byStatus = Object.fromEntries(
    Object.values(ApplicationStatus).map((status) => [
      status,
      grouped.find((row) => row.status === status)?._count._all ?? 0,
    ]),
  ) as Record<ApplicationStatus, number>;
  const checklist = {
    headline: Boolean(profile.headline),
    summary: Boolean(profile.summary),
    location: Boolean(profile.location),
    phone: Boolean(profile.phone),
    skills: profile.skills.length > 0,
    education: profile.education.length > 0,
    experience: profile.experience.length > 0,
    resume: Boolean(profile.resume),
  };
  const done = Object.values(checklist).filter(Boolean).length;
  return {
    totalApplications: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    byStatus,
    recentApplications: recent,
    profileChecklist: checklist,
    profileCompletion: Math.round((done / Object.keys(checklist).length) * 100),
  };
}
