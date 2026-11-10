import { ApplicationStatus, JobStatus, Prisma } from '@prisma/client';
import { prisma, withWriteConflictRetry } from '../db/prisma.js';
import type { AuthUser } from '../middleware/authenticate.js';
import { conflict, forbidden, notFound, unprocessable } from '../utils/apiError.js';
import { pageArgs, pageMeta } from '../utils/http.js';
import type {
  AdminApplicationListQuery,
  ApplicationListQuery,
  CreateApplicationInput,
} from '../validation/application.validation.js';
import { effectiveStatus } from './job.service.js';
import { getSeekerProfileId } from './jobSeeker.service.js';
import type { StoredResume } from './resume.service.js';

const { APPLIED, UNDER_REVIEW, SHORTLISTED, INTERVIEW, REJECTED, HIRED, WITHDRAWN } =
  ApplicationStatus;

/** Forward moves available to the hiring side. Rejected, hired and withdrawn are final. */
const REVIEW_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: [UNDER_REVIEW, REJECTED],
  UNDER_REVIEW: [SHORTLISTED, REJECTED],
  SHORTLISTED: [INTERVIEW, REJECTED],
  INTERVIEW: [HIRED, REJECTED],
  REJECTED: [],
  HIRED: [],
  WITHDRAWN: [],
};

const WITHDRAWABLE: ApplicationStatus[] = [APPLIED, UNDER_REVIEW, SHORTLISTED, INTERVIEW];

const detailInclude = {
  job: {
    include: {
      company: {
        select: {
          id: true,
          name: true,
          employerProfile: { select: { userId: true } },
        },
      },
    },
  },
  candidate: {
    include: {
      user: { select: { id: true, name: true, email: true } },
      skills: { include: { skill: { select: { name: true } } } },
      education: { orderBy: { startDate: 'desc' } },
      experience: { orderBy: { startDate: 'desc' } },
    },
  },
  resume: {
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
  },
  history: {
    orderBy: { timestamp: 'asc' },
    include: { changedBy: { select: { name: true, role: true } } },
  },
} satisfies Prisma.ApplicationInclude;

type ApplicationRow = Prisma.ApplicationGetPayload<{ include: typeof detailInclude }>;

function assertCanView(application: ApplicationRow, user: AuthUser): void {
  if (user.role === 'ADMIN') return;
  const allowed =
    user.role === 'JOB_SEEKER'
      ? application.candidate.user.id === user.id
      : application.job.company.employerProfile.userId === user.id;
  if (!allowed) throw forbidden();
}

async function loadApplication(id: string): Promise<ApplicationRow> {
  const application = await prisma.application.findUnique({
    where: { id },
    include: detailInclude,
  });
  if (!application) throw notFound('Application not found');
  return application;
}

function toApplicationDetails(application: ApplicationRow, viewer: AuthUser) {
  const { job, candidate, resume, history, ...rest } = application;
  const { company, ...jobFields } = job;
  const isCandidate = viewer.role === 'JOB_SEEKER';
  // A candidate who withdrew no longer shares a resume with the employer.
  const resumeVisible = isCandidate || viewer.role === 'ADMIN' || rest.status !== WITHDRAWN;
  return {
    ...rest,
    job: {
      ...jobFields,
      status: effectiveStatus(job),
      company: { id: company.id, name: company.name },
    },
    resume: resumeVisible ? resume : null,
    history: history.map(({ changedBy, ...entry }) => ({ ...entry, changedBy })),
    canWithdraw: isCandidate && WITHDRAWABLE.includes(rest.status),
    allowedNextStatuses: isCandidate ? [] : REVIEW_TRANSITIONS[rest.status],
    candidate: isCandidate
      ? null
      : {
          id: candidate.id,
          name: candidate.user.name,
          email: candidate.user.email,
          phone: candidate.phone,
          location: candidate.location,
          headline: candidate.headline,
          summary: candidate.summary,
          skills: candidate.skills.map((entry) => entry.skill.name),
          education: candidate.education,
          experience: candidate.experience,
        },
  };
}

export async function applyToJob(user: AuthUser, input: CreateApplicationInput) {
  const candidateId = await getSeekerProfileId(user.id);
  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: {
      status: true,
      expiresAt: true,
      moderatedAt: true,
      company: { select: { employerProfile: { select: { user: { select: { isActive: true } } } } } },
    },
  });
  if (!job || job.moderatedAt || !job.company.employerProfile.user.isActive) {
    throw notFound('Job not found');
  }
  const status = effectiveStatus(job);
  if (status === JobStatus.EXPIRED) throw conflict('The application deadline has passed');
  if (status !== JobStatus.ACTIVE) throw conflict('This job is not accepting applications');

  const existing = await prisma.application.findUnique({
    where: { jobId_candidateId: { jobId: input.jobId, candidateId } },
    select: { id: true },
  });
  if (existing) throw conflict('You have already applied to this job');

  const profile = await prisma.jobSeekerProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { currentResumeId: true },
  });
  if (!profile.currentResumeId) {
    throw unprocessable('Upload a resume before applying');
  }

  const resumeId = profile.currentResumeId;
  try {
    return await withWriteConflictRetry(() =>
      prisma.application.create({
        data: {
          jobId: input.jobId,
          candidateId,
          resumeId,
          coverLetter: input.coverLetter ?? null,
          history: { create: { newStatus: APPLIED, changedById: user.id } },
        },
        select: { id: true, jobId: true, status: true, createdAt: true },
      }),
    );
  } catch (error) {
    // Two simultaneous submissions are settled by the unique (jobId, candidateId) constraint.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('You have already applied to this job');
    }
    throw error;
  }
}

export async function listOwnApplications(userId: string, query: ApplicationListQuery) {
  const candidateId = await getSeekerProfileId(userId);
  const where: Prisma.ApplicationWhereInput = {
    candidateId,
    ...(query.status ? { status: query.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            company: { select: { name: true } },
          },
        },
      },
      ...pageArgs(query.page, query.limit),
    }),
    prisma.application.count({ where }),
  ]);
  return {
    items: rows.map((row) => ({ ...row, canWithdraw: WITHDRAWABLE.includes(row.status) })),
    meta: pageMeta(total, query.page, query.limit),
  };
}

export async function getApplicationDetails(id: string, user: AuthUser) {
  const application = await loadApplication(id);
  assertCanView(application, user);
  return toApplicationDetails(application, user);
}

/** The status guard in the WHERE clause makes concurrent updates fail instead of overwrite. */
async function recordTransition(
  id: string,
  from: ApplicationStatus,
  to: ApplicationStatus,
  actorId: string,
): Promise<void> {
  await withWriteConflictRetry(() =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.application.updateMany({
        where: { id, status: from },
        data: { status: to },
      });
      if (count === 0) throw conflict('This application was just updated. Refresh and try again.');
      await tx.applicationStatusHistory.create({
        data: { applicationId: id, previousStatus: from, newStatus: to, changedById: actorId },
      });
    }),
  );
}

export async function updateApplicationStatus(
  id: string,
  user: AuthUser,
  next: ApplicationStatus,
) {
  const application = await loadApplication(id);
  assertCanView(application, user);
  if (!REVIEW_TRANSITIONS[application.status].includes(next)) {
    throw conflict(
      `An application cannot move from ${application.status} to ${next}`,
    );
  }
  await recordTransition(id, application.status, next, user.id);
  return getApplicationDetails(id, user);
}

export async function withdrawApplication(id: string, user: AuthUser) {
  const application = await loadApplication(id);
  if (application.candidate.user.id !== user.id) throw forbidden();
  if (!WITHDRAWABLE.includes(application.status)) {
    throw conflict('This application can no longer be withdrawn');
  }
  await recordTransition(id, application.status, WITHDRAWN, user.id);
  return getApplicationDetails(id, user);
}

export async function getApplicationResumeFile(id: string, user: AuthUser): Promise<StoredResume> {
  const application = await prisma.application.findUnique({
    where: { id },
    select: {
      status: true,
      candidate: { select: { userId: true } },
      job: { select: { company: { select: { employerProfile: { select: { userId: true } } } } } },
      resume: { select: { originalName: true, storedName: true, mimeType: true } },
    },
  });
  if (!application) throw notFound('Application not found');
  const isCandidate = application.candidate.userId === user.id;
  const isHiringEmployer =
    user.role === 'EMPLOYER' && application.job.company.employerProfile.userId === user.id;
  if (user.role !== 'ADMIN' && !isCandidate && !isHiringEmployer) throw forbidden();
  if (isHiringEmployer && application.status === WITHDRAWN) {
    throw forbidden('The candidate has withdrawn this application');
  }
  if (!application.resume) throw notFound('Resume not found');
  return application.resume;
}

const MONTH_MS = 30.44 * 24 * 3600 * 1000;

function totalExperienceYears(entries: { startDate: Date; endDate: Date | null }[]): number {
  const months = entries.reduce((sum, entry) => {
    const end = entry.endDate ?? new Date();
    return sum + Math.max(0, (end.getTime() - entry.startDate.getTime()) / MONTH_MS);
  }, 0);
  return Math.round((months / 12) * 10) / 10;
}

export async function listJobApplicants(
  jobId: string,
  user: AuthUser,
  query: ApplicationListQuery,
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      company: { select: { employerProfile: { select: { userId: true } } } },
    },
  });
  if (!job) throw notFound('Job not found');
  if (user.role !== 'ADMIN' && job.company.employerProfile.userId !== user.id) throw forbidden();

  const where: Prisma.ApplicationWhereInput = {
    jobId,
    ...(query.status ? { status: query.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        resumeId: true,
        candidate: {
          select: {
            headline: true,
            user: { select: { name: true } },
            skills: { select: { skill: { select: { name: true } } } },
            experience: {
              orderBy: { startDate: 'desc' },
              select: { jobTitle: true, company: true, startDate: true, endDate: true },
            },
          },
        },
      },
      ...pageArgs(query.page, query.limit),
    }),
    prisma.application.count({ where }),
  ]);
  return {
    job: { id: job.id, title: job.title },
    items: rows.map(({ candidate, resumeId, ...row }) => ({
      ...row,
      hasResume: Boolean(resumeId) && row.status !== WITHDRAWN,
      candidate: {
        name: candidate.user.name,
        headline: candidate.headline,
        skills: candidate.skills.map((entry) => entry.skill.name),
        experienceYears: totalExperienceYears(candidate.experience),
        latestRole: candidate.experience[0]
          ? `${candidate.experience[0].jobTitle} at ${candidate.experience[0].company}`
          : null,
      },
    })),
    meta: pageMeta(total, query.page, query.limit),
  };
}

// IDs are resolved first because Prisma's MongoDB queries for relation filters inside OR fail.
async function applicationSearchFilter(text: string): Promise<Prisma.ApplicationWhereInput> {
  const contains = { contains: text, mode: 'insensitive' as const };
  const [companies, users] = await Promise.all([
    prisma.company.findMany({ where: { name: contains }, select: { id: true } }),
    prisma.user.findMany({
      where: { role: 'JOB_SEEKER', name: contains },
      select: { id: true },
    }),
  ]);
  const [jobs, profiles] = await Promise.all([
    prisma.job.findMany({
      where: {
        OR: [
          { title: contains },
          { companyId: { in: companies.map((company) => company.id) } },
        ],
      },
      select: { id: true },
    }),
    prisma.jobSeekerProfile.findMany({
      where: { userId: { in: users.map((user) => user.id) } },
      select: { id: true },
    }),
  ]);
  return {
    OR: [
      { jobId: { in: jobs.map((job) => job.id) } },
      { candidateId: { in: profiles.map((profile) => profile.id) } },
    ],
  };
}

export async function listAllApplications(query: AdminApplicationListQuery) {
  const where: Prisma.ApplicationWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? await applicationSearchFilter(query.q) : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        job: { select: { id: true, title: true, company: { select: { name: true } } } },
        candidate: { select: { user: { select: { name: true, email: true } } } },
      },
      ...pageArgs(query.page, query.limit),
    }),
    prisma.application.count({ where }),
  ]);
  return {
    items: rows.map(({ candidate, ...row }) => ({ ...row, candidate: candidate.user })),
    meta: pageMeta(total, query.page, query.limit),
  };
}
