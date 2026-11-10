import { JobStatus, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { AuthUser } from '../middleware/authenticate.js';
import { conflict, forbidden, notFound, unprocessable } from '../utils/apiError.js';
import { pageArgs, pageMeta, type Paginated } from '../utils/http.js';
import type {
  CreateJobInput,
  JobSearchQuery,
  ManagedJobsQuery,
  ModerationInput,
  UpdateJobInput,
} from '../validation/job.validation.js';
import { requireOwnCompanyId } from './employer.service.js';
import { resolveSkillIds } from './skill.service.js';

const jobInclude = {
  company: {
    select: {
      id: true,
      name: true,
      website: true,
      industry: true,
      size: true,
      location: true,
      description: true,
    },
  },
  skills: { include: { skill: { select: { name: true } } } },
  _count: { select: { applications: true } },
} satisfies Prisma.JobInclude;

type JobRow = Prisma.JobGetPayload<{ include: typeof jobInclude }>;

/** A job past its deadline is expired even before the background sweep has updated its row. */
export function effectiveStatus(job: { status: JobStatus; expiresAt: Date | null }): JobStatus {
  if (job.status === JobStatus.ACTIVE && job.expiresAt && job.expiresAt <= new Date()) {
    return JobStatus.EXPIRED;
  }
  return job.status;
}

const isAcceptingApplications = (job: {
  status: JobStatus;
  expiresAt: Date | null;
  moderatedAt: Date | null;
}) => effectiveStatus(job) === JobStatus.ACTIVE && !job.moderatedAt;

function toManagedJob(job: JobRow) {
  const { skills, _count, ...rest } = job;
  return {
    ...rest,
    status: effectiveStatus(job),
    skills: skills.map((entry) => entry.skill.name).sort((a, b) => a.localeCompare(b)),
    applicationCount: _count.applications,
    applicationsOpen: isAcceptingApplications(job),
  };
}

/** Public shape: employer-only figures and moderation notes are removed. */
function toPublicJob(job: JobRow) {
  const {
    applicationCount: _applicationCount,
    moderationReason: _moderationReason,
    moderatedAt: _moderatedAt,
    ...rest
  } = toManagedJob(job);
  return rest;
}

const activeEmployer = { employerProfile: { user: { isActive: true } } };

function publiclyListedWhere(): Prisma.JobWhereInput {
  return {
    status: JobStatus.ACTIVE,
    // MongoDB omits optional fields left out on create, and `null` filters do not match those.
    AND: [
      { OR: [{ moderatedAt: null }, { moderatedAt: { isSet: false } }] },
      {
        OR: [
          { expiresAt: null },
          { expiresAt: { isSet: false } },
          { expiresAt: { gt: new Date() } },
        ],
      },
    ],
    company: activeEmployer,
  };
}

const textContains = (value: string) => ({ contains: value, mode: 'insensitive' as const });

async function jobIdsWithSkill(text: string): Promise<string[]> {
  const skills = await prisma.skill.findMany({
    where: { name: textContains(text) },
    select: { id: true },
  });
  const links = await prisma.jobSkill.findMany({
    where: { skillId: { in: skills.map((skill) => skill.id) } },
    select: { jobId: true },
  });
  return [...new Set(links.map((link) => link.jobId))];
}

// IDs are resolved first because Prisma's MongoDB query for a to-many filter inside OR fails.
async function searchWhere(query: JobSearchQuery): Promise<Prisma.JobWhereInput[]> {
  const conditions: Prisma.JobWhereInput[] = [];
  if (query.q) {
    const [companies, skillJobIds] = await Promise.all([
      prisma.company.findMany({
        where: { name: textContains(query.q) },
        select: { id: true },
      }),
      jobIdsWithSkill(query.q),
    ]);
    conditions.push({
      OR: [
        { title: textContains(query.q) },
        { location: textContains(query.q) },
        { companyId: { in: companies.map((company) => company.id) } },
        { id: { in: skillJobIds } },
      ],
    });
  }
  if (query.location) conditions.push({ location: textContains(query.location) });
  if (query.skill) conditions.push({ id: { in: await jobIdsWithSkill(query.skill) } });
  if (query.jobType) conditions.push({ jobType: query.jobType });
  if (query.workMode) conditions.push({ workMode: query.workMode });
  if (query.experienceLevel) conditions.push({ experienceLevel: query.experienceLevel });
  return conditions;
}

export async function searchJobs(query: JobSearchQuery) {
  const where: Prisma.JobWhereInput = {
    AND: [publiclyListedWhere(), ...(await searchWhere(query))],
  };
  const direction = query.sort === 'oldest' ? 'asc' : 'desc';
  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: jobInclude,
      orderBy: [{ publishedAt: direction }, { id: direction }],
      ...pageArgs(query.page, query.limit),
    }),
    prisma.job.count({ where }),
  ]);
  return { items: rows.map(toPublicJob), meta: pageMeta(total, query.page, query.limit) };
}

export async function getJobFilterOptions() {
  const rows = await prisma.job.findMany({
    where: publiclyListedWhere(),
    distinct: ['location'],
    orderBy: { location: 'asc' },
    select: { location: true },
    take: 100,
  });
  return { locations: rows.map((row) => row.location) };
}

async function findJobOwnerId(jobId: string): Promise<string | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { company: { select: { employerProfile: { select: { userId: true } } } } },
  });
  return job?.company.employerProfile.userId ?? null;
}

async function viewerApplication(jobId: string, viewer: AuthUser | undefined) {
  if (viewer?.role !== 'JOB_SEEKER') return null;
  return prisma.application.findFirst({
    where: { jobId, candidate: { userId: viewer.id } },
    select: { id: true, status: true },
  });
}

export async function getJobDetails(id: string, viewer: AuthUser | undefined) {
  const job = await prisma.job.findUnique({ where: { id }, include: jobInclude });
  if (!job) throw notFound('Job not found');

  const isAdmin = viewer?.role === 'ADMIN';
  const isOwner = viewer?.role === 'EMPLOYER' && (await findJobOwnerId(id)) === viewer.id;
  if (isAdmin || isOwner) {
    return { ...toManagedJob(job), viewerApplication: null, canManage: true };
  }

  // Closed and expired postings stay reachable by link so they can show "Applications Closed".
  const status = effectiveStatus(job);
  const employerIsActive = await prisma.company.count({
    where: { id: job.companyId, ...activeEmployer },
  });
  if (status === JobStatus.DRAFT || job.moderatedAt || !employerIsActive) {
    throw notFound('Job not found');
  }
  return {
    ...toPublicJob(job),
    viewerApplication: await viewerApplication(id, viewer),
    canManage: false,
  };
}

async function assertCanManage(jobId: string, user: AuthUser): Promise<void> {
  const ownerId = await findJobOwnerId(jobId);
  if (!ownerId) throw notFound('Job not found');
  if (user.role !== 'ADMIN' && ownerId !== user.id) throw forbidden();
}

function assertFutureDeadline(expiresAt: Date | null | undefined): void {
  if (expiresAt && expiresAt <= new Date()) {
    throw unprocessable('Application deadline must be in the future', [
      { field: 'expiresAt', message: 'Application deadline must be in the future' },
    ]);
  }
}

function jobData(input: UpdateJobInput) {
  const { skills: _skills, ...fields } = input;
  return {
    ...fields,
    salaryMin: fields.salaryMin ?? null,
    salaryMax: fields.salaryMax ?? null,
    expiresAt: fields.expiresAt ?? null,
  };
}

export async function createJob(user: AuthUser, input: CreateJobInput) {
  assertFutureDeadline(input.expiresAt);
  const companyId = await requireOwnCompanyId(user.id);
  const { status, ...fields } = input;
  const skillIds = await resolveSkillIds(input.skills);
  const job = await prisma.job.create({
    data: {
      ...jobData(fields),
      companyId,
      status,
      publishedAt: status === JobStatus.ACTIVE ? new Date() : null,
      skills: { create: skillIds.map((skillId) => ({ skillId })) },
    },
    include: jobInclude,
  });
  return toManagedJob(job);
}

export async function updateJob(id: string, user: AuthUser, input: UpdateJobInput) {
  await assertCanManage(id, user);
  const existing = await prisma.job.findUniqueOrThrow({
    where: { id },
    select: { expiresAt: true, moderatedAt: true },
  });
  if (existing.moderatedAt && user.role !== 'ADMIN') {
    throw forbidden('This job was deactivated by an administrator');
  }
  // An unchanged past deadline may be resubmitted when editing an already expired job.
  if (input.expiresAt?.getTime() !== existing.expiresAt?.getTime()) {
    assertFutureDeadline(input.expiresAt);
  }
  const skillIds = await resolveSkillIds(input.skills);
  return prisma.$transaction(async (tx) => {
    await tx.jobSkill.deleteMany({ where: { jobId: id } });
    const job = await tx.job.update({
      where: { id },
      data: {
        ...jobData(input),
        skills: { create: skillIds.map((skillId) => ({ skillId })) },
      },
      include: jobInclude,
    });
    return toManagedJob(job);
  });
}

const ALLOWED_JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: [JobStatus.ACTIVE, JobStatus.CLOSED],
  ACTIVE: [JobStatus.DRAFT, JobStatus.CLOSED],
  CLOSED: [JobStatus.ACTIVE],
  EXPIRED: [JobStatus.ACTIVE, JobStatus.CLOSED],
};

export async function changeJobStatus(id: string, user: AuthUser, next: JobStatus) {
  await assertCanManage(id, user);
  const job = await prisma.job.findUniqueOrThrow({
    where: { id },
    select: { status: true, expiresAt: true, moderatedAt: true, publishedAt: true },
  });
  if (job.moderatedAt) {
    throw forbidden('This job was deactivated by an administrator and must be restored first');
  }
  const current = effectiveStatus(job);
  if (current === next) throw conflict(`This job is already ${next.toLowerCase()}`);
  if (!ALLOWED_JOB_TRANSITIONS[current].includes(next)) {
    throw conflict(`A ${current.toLowerCase()} job cannot be changed to ${next.toLowerCase()}`);
  }
  if (next === JobStatus.ACTIVE && job.expiresAt && job.expiresAt <= new Date()) {
    throw unprocessable('Set a future application deadline before activating this job');
  }
  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: next,
      publishedAt: next === JobStatus.ACTIVE ? (job.publishedAt ?? new Date()) : undefined,
    },
    include: jobInclude,
  });
  return toManagedJob(updated);
}

export async function deleteJob(id: string, user: AuthUser): Promise<void> {
  await assertCanManage(id, user);
  const applications = await prisma.application.count({ where: { jobId: id } });
  if (applications > 0) {
    throw conflict('A job with applications cannot be deleted. Close it instead.');
  }
  await prisma.job.delete({ where: { id } });
}

/** Marks every active posting whose deadline has passed as expired. */
export async function expireOverdueJobs(): Promise<number> {
  const { count } = await prisma.job.updateMany({
    // MongoDB sorts missing and null values below dates, so the range needs a lower bound.
    where: { status: JobStatus.ACTIVE, expiresAt: { gt: new Date(0), lte: new Date() } },
    data: { status: JobStatus.EXPIRED },
  });
  return count;
}

async function managedWhere(query: ManagedJobsQuery): Promise<Prisma.JobWhereInput> {
  const statusFilter = query.status ? { status: query.status } : {};
  if (!query.q) return statusFilter;
  const companies = await prisma.company.findMany({
    where: { name: textContains(query.q) },
    select: { id: true },
  });
  return {
    ...statusFilter,
    OR: [
      { title: textContains(query.q) },
      { companyId: { in: companies.map((company) => company.id) } },
    ],
  };
}

async function listManagedJobs(where: Prisma.JobWhereInput, query: ManagedJobsQuery) {
  await expireOverdueJobs();
  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: jobInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.page, query.limit),
    }),
    prisma.job.count({ where }),
  ]);
  return { items: rows.map(toManagedJob), meta: pageMeta(total, query.page, query.limit) };
}

export async function listEmployerJobs(
  userId: string,
  query: ManagedJobsQuery,
): Promise<Paginated<ReturnType<typeof toManagedJob>>> {
  const scope: Prisma.JobWhereInput = { company: { employerProfile: { userId } } };
  return listManagedJobs({ AND: [scope, await managedWhere(query)] }, query);
}

export const listAllJobs = async (query: ManagedJobsQuery) =>
  listManagedJobs(await managedWhere(query), query);

export async function moderateJob(id: string, input: ModerationInput) {
  const job = await prisma.job.findUnique({ where: { id }, select: { moderatedAt: true } });
  if (!job) throw notFound('Job not found');
  if (input.action === 'DEACTIVATE') {
    if (job.moderatedAt) throw conflict('This job is already deactivated');
    const updated = await prisma.job.update({
      where: { id },
      data: { status: JobStatus.CLOSED, moderatedAt: new Date(), moderationReason: input.reason },
      include: jobInclude,
    });
    return toManagedJob(updated);
  }
  if (!job.moderatedAt) throw conflict('This job is not deactivated');
  const updated = await prisma.job.update({
    where: { id },
    data: { moderatedAt: null, moderationReason: null },
    include: jobInclude,
  });
  return toManagedJob(updated);
}
