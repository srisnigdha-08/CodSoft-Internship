import { JobStatus } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { notFound, unprocessable } from '../utils/apiError.js';
import type { CompanyInput, EmployerProfileInput } from '../validation/profile.validation.js';
import { expireOverdueJobs } from './job.service.js';

async function getEmployerProfileId(userId: string): Promise<string> {
  const profile = await prisma.employerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw notFound('Employer profile not found');
  return profile.id;
}

export async function getEmployerProfile(userId: string) {
  const profile = await prisma.employerProfile.findUniqueOrThrow({
    where: { userId },
    include: { user: { select: { name: true, email: true } }, company: true },
  });
  const { user, ...rest } = profile;
  return { ...rest, name: user.name, email: user.email };
}

export async function updateEmployerProfile(userId: string, input: EmployerProfileInput) {
  const { name, ...profile } = input;
  await prisma.user.update({
    where: { id: userId },
    data: { name, employerProfile: { update: profile } },
  });
  return getEmployerProfile(userId);
}

export async function getOwnCompany(userId: string) {
  const profile = await prisma.employerProfile.findUniqueOrThrow({
    where: { userId },
    select: { company: true },
  });
  return profile.company;
}

/** Returns the employer's company id, or explains that a company must be created first. */
export async function requireOwnCompanyId(userId: string): Promise<string> {
  const company = await getOwnCompany(userId);
  if (!company) throw unprocessable('Create your company profile before posting a job');
  return company.id;
}

export async function saveOwnCompany(userId: string, input: CompanyInput) {
  const employerProfileId = await getEmployerProfileId(userId);
  return prisma.company.upsert({
    where: { employerProfileId },
    create: { ...input, employerProfileId },
    update: input,
  });
}

export async function getPublicCompany(id: string) {
  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      website: true,
      industry: true,
      size: true,
      location: true,
      description: true,
    },
  });
  if (!company) throw notFound('Company not found');
  return company;
}

export async function getEmployerDashboard(userId: string) {
  await expireOverdueJobs();
  const company = await getOwnCompany(userId);
  if (!company) {
    return {
      hasCompany: false,
      totalJobs: 0,
      activeJobs: 0,
      closedJobs: 0,
      totalApplications: 0,
      pendingReview: 0,
      shortlisted: 0,
      recentApplications: [],
    };
  }
  const jobScope = { companyId: company.id };
  const applicationScope = { job: jobScope };
  const [totalJobs, activeJobs, closedJobs, totalApplications, pendingReview, shortlisted, recent] =
    await Promise.all([
      prisma.job.count({ where: jobScope }),
      prisma.job.count({ where: { ...jobScope, status: JobStatus.ACTIVE } }),
      prisma.job.count({
        where: { ...jobScope, status: { in: [JobStatus.CLOSED, JobStatus.EXPIRED] } },
      }),
      prisma.application.count({ where: applicationScope }),
      prisma.application.count({
        where: { ...applicationScope, status: { in: ['APPLIED', 'UNDER_REVIEW'] } },
      }),
      prisma.application.count({ where: { ...applicationScope, status: 'SHORTLISTED' } }),
      prisma.application.findMany({
        where: applicationScope,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          createdAt: true,
          job: { select: { id: true, title: true } },
          candidate: { select: { user: { select: { name: true } } } },
        },
      }),
    ]);
  return {
    hasCompany: true,
    totalJobs,
    activeJobs,
    closedJobs,
    totalApplications,
    pendingReview,
    shortlisted,
    recentApplications: recent.map(({ candidate, ...application }) => ({
      ...application,
      candidateName: candidate.user.name,
    })),
  };
}
