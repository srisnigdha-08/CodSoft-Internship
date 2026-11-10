import { ApplicationStatus, JobStatus, type Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { AuthUser } from '../middleware/authenticate.js';
import { conflict, notFound } from '../utils/apiError.js';
import { pageArgs, pageMeta } from '../utils/http.js';
import type {
  AdminEmployerListQuery,
  AdminUserListQuery,
} from '../validation/application.validation.js';
import { publicUserSelect } from './auth.service.js';
import { expireOverdueJobs } from './job.service.js';

export async function getPlatformStats() {
  await expireOverdueJobs();
  const [users, jobs, totalApplications, grouped] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.application.count(),
    prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const usersWithRole = (role: string) =>
    users.find((row) => row.role === role)?._count._all ?? 0;
  const totalUsers = users.reduce((sum, row) => sum + row._count._all, 0);
  return {
    totalUsers,
    totalJobSeekers: usersWithRole('JOB_SEEKER'),
    totalEmployers: usersWithRole('EMPLOYER'),
    totalJobs: jobs.reduce((sum, row) => sum + row._count._all, 0),
    activeJobs: jobs.find((row) => row.status === JobStatus.ACTIVE)?._count._all ?? 0,
    totalApplications,
    applicationsByStatus: Object.fromEntries(
      Object.values(ApplicationStatus).map((status) => [
        status,
        grouped.find((row) => row.status === status)?._count._all ?? 0,
      ]),
    ) as Record<ApplicationStatus, number>,
  };
}

export async function listUsers(query: AdminUserListQuery) {
  const contains = query.q ? { contains: query.q, mode: 'insensitive' as const } : undefined;
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    ...(contains ? { OR: [{ name: contains }, { email: contains }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.page, query.limit),
    }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: pageMeta(total, query.page, query.limit) };
}

export async function setUserActive(id: string, admin: AuthUser, isActive: boolean) {
  if (id === admin.id) throw conflict('You cannot change the status of your own account');
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw notFound('User not found');
  return prisma.user.update({ where: { id }, data: { isActive }, select: publicUserSelect });
}

export async function listEmployers(query: AdminEmployerListQuery) {
  const contains = query.q ? { contains: query.q, mode: 'insensitive' as const } : undefined;
  let where: Prisma.EmployerProfileWhereInput = {};
  if (contains) {
    // IDs are resolved first because Prisma's MongoDB queries for relation filters inside OR fail.
    const [users, companies] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'EMPLOYER', OR: [{ name: contains }, { email: contains }] },
        select: { id: true },
      }),
      prisma.company.findMany({
        where: { name: contains },
        select: { employerProfileId: true },
      }),
    ]);
    where = {
      OR: [
        { userId: { in: users.map((user) => user.id) } },
        { id: { in: companies.map((company) => company.employerProfileId) } },
      ],
    };
  }
  const [rows, total] = await Promise.all([
    prisma.employerProfile.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        position: true,
        phone: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
        company: {
          select: {
            id: true,
            name: true,
            industry: true,
            location: true,
            _count: { select: { jobs: true } },
          },
        },
      },
      ...pageArgs(query.page, query.limit),
    }),
    prisma.employerProfile.count({ where }),
  ]);
  return {
    items: rows.map(({ company, ...row }) => ({
      ...row,
      company: company
        ? {
            id: company.id,
            name: company.name,
            industry: company.industry,
            location: company.location,
            jobCount: company._count.jobs,
          }
        : null,
    })),
    meta: pageMeta(total, query.page, query.limit),
  };
}
