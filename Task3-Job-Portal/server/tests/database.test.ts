import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTo,
  connectedDatabaseName,
  createJob,
  employerWithCompany,
  jobPayload,
  prisma,
  registerAgent,
  resetDatabase,
  seekerWithResume,
} from './helpers.js';
import { databaseNameFrom } from '../src/config/databaseName.js';
import { assertSafeTestDatabase } from './testDatabase.js';

async function jobFixture() {
  const employer = await employerWithCompany();
  const seeker = await seekerWithResume();
  const job = await createJob(employer.agent);
  const application = await applyTo(seeker.agent, job.id);
  const row = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
  const company = await prisma.company.findFirstOrThrow();
  return { job, row, company };
}

function baseJob(companyId: string) {
  const { skills: _skills, status: _status, ...fields } = jobPayload();
  return { ...fields, companyId } as Parameters<typeof prisma.job.create>[0]['data'];
}

describe('test database safety', () => {
  const uri = (name: string) => `mongodb://127.0.0.1:27017/${name}?replicaSet=rs0`;

  it('is connected to a database whose name contains "test"', async () => {
    expect((await connectedDatabaseName()).toLowerCase()).toContain('test');
  });

  it('refuses a database name without "test"', () => {
    expect(() => assertSafeTestDatabase(uri('job_portal'))).toThrow(/must contain "test"/);
  });

  it('refuses to share a database with development', () => {
    const shared = uri('job_portal_test');
    expect(() => assertSafeTestDatabase(shared, shared)).toThrow(/same database/);
  });

  it('refuses a missing or nameless URI', () => {
    expect(() => assertSafeTestDatabase(undefined)).toThrow(/must be set/);
    expect(() => assertSafeTestDatabase('mongodb://127.0.0.1:27017')).toThrow(/names a database/);
  });

  it('accepts a separate test database and reads names from multi-host URIs', () => {
    expect(assertSafeTestDatabase(uri('job_portal_test'), uri('job_portal'))).toBe('job_portal_test');
    expect(databaseNameFrom('mongodb://a:1,b:2/portal_test?replicaSet=rs0')).toBe('portal_test');
    expect(databaseNameFrom('mongodb+srv://user:secret@cluster.example/portal_test')).toBe('portal_test');
  });
});

describe('database constraints', () => {
  beforeEach(resetDatabase);

  it('enforces one application per candidate per job', async () => {
    const { row } = await jobFixture();
    await expect(
      prisma.application.create({ data: { jobId: row.jobId, candidateId: row.candidateId } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces unique user emails', async () => {
    const data = { email: 'same@example.com', name: 'A', passwordHash: 'x', role: 'ADMIN' as const };
    await prisma.user.create({ data });
    await expect(prisma.user.create({ data })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows many profiles to have no current resume', async () => {
    await registerAgent('JOB_SEEKER', 'First Without Resume');
    await registerAgent('JOB_SEEKER', 'Second Without Resume');
    const profiles = await prisma.jobSeekerProfile.findMany({ select: { currentResumeId: true } });
    expect(profiles).toEqual([{ currentResumeId: null }, { currentResumeId: null }]);
  });

  it('enforces the salary range with a collection validator', async () => {
    const { company } = await jobFixture();
    await expect(
      prisma.job.create({
        data: { ...baseJob(company.id), salaryMin: 100, salaryMax: 50 },
      }),
    ).rejects.toThrow(/validation/i);
  });

  it('accepts a job with no salary under the validator', async () => {
    const { company } = await jobFixture();
    const job = await prisma.job.create({
      data: { ...baseJob(company.id), salaryMin: null, salaryMax: null },
    });
    expect(job.salaryMin).toBeNull();
  });

  it('rejects an education row that ends before it starts', async () => {
    const { row } = await jobFixture();
    await expect(
      prisma.education.create({
        data: {
          profileId: row.candidateId,
          institution: 'X',
          degree: 'Y',
          fieldOfStudy: 'Z',
          startDate: new Date('2021-01-01'),
          endDate: new Date('2020-01-01'),
        },
      }),
    ).rejects.toThrow(/validation/i);
  });

  it('rejects connecting an application to a missing job', async () => {
    const { row } = await jobFixture();
    await expect(
      prisma.application.create({
        data: {
          job: { connect: { id: randomUUID() } },
          candidate: { connect: { id: row.candidateId } },
        },
      }),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('prevents deleting a job that has applications', async () => {
    const { job } = await jobFixture();
    await expect(prisma.job.delete({ where: { id: job.id } })).rejects.toThrow();
    expect(await prisma.job.count({ where: { id: job.id } })).toBe(1);
  });

  it('cascades status history when an application is deleted', async () => {
    const { row } = await jobFixture();
    expect(await prisma.applicationStatusHistory.count()).toBe(1);
    await prisma.application.delete({ where: { id: row.id } });
    expect(await prisma.applicationStatusHistory.count()).toBe(0);
  });

  it('allows only one company per employer profile', async () => {
    const { company } = await jobFixture();
    await expect(
      prisma.company.create({
        data: { name: 'Second', employerProfileId: company.employerProfileId },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('keeps skill names unique by normalized value', async () => {
    await prisma.skill.create({ data: { name: 'Go', normalizedName: 'go' } });
    await expect(
      prisma.skill.create({ data: { name: 'GO', normalizedName: 'go' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects an experience row that is current but has an end date', async () => {
    const { row } = await jobFixture();
    await expect(
      prisma.experience.create({
        data: {
          profileId: row.candidateId,
          company: 'X Corp',
          jobTitle: 'Dev',
          startDate: new Date('2020-01-01'),
          endDate: new Date('2021-01-01'),
          currentlyWorking: true,
        },
      }),
    ).rejects.toThrow(/validation/i);
  });
});
