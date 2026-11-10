import type { ApplicationStatus, JobStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/services/auth.service.js';

export const app = createApp();
export { prisma };

export const PASSWORD = 'Secret123';

export type Agent = ReturnType<typeof request.agent>;

const COLLECTIONS = [
  'ApplicationStatusHistory',
  'Application',
  'JobSkill',
  'JobSeekerSkill',
  'Job',
  'Skill',
  'Education',
  'Experience',
  'Resume',
  'JobSeekerProfile',
  'Company',
  'EmployerProfile',
  'User',
];

/** Reports the database this connection is really using, whatever the environment claims. */
export async function connectedDatabaseName(): Promise<string> {
  const stats = await prisma.$runCommandRaw({ dbStats: 1 });
  return String(stats.db);
}

export async function resetDatabase(): Promise<void> {
  const name = await connectedDatabaseName();
  if (!name.toLowerCase().includes('test')) {
    throw new Error(`Refusing to erase "${name}": the database name does not contain "test"`);
  }
  // Documents are removed rather than collections dropped, which keeps indexes and validators.
  for (const collection of COLLECTIONS) {
    await prisma.$runCommandRaw({ delete: collection, deletes: [{ q: {}, limit: 0 }] });
  }
}

const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}@example.com`;

export async function registerAgent(role: 'JOB_SEEKER' | 'EMPLOYER', name = 'Test User') {
  const agent = request.agent(app);
  const email = uniqueEmail(role.toLowerCase());
  const response = await agent
    .post('/api/auth/register')
    .send({ name, email, password: PASSWORD, role })
    .expect(201);
  return { agent, email, user: response.body.data as { id: string; email: string } };
}

export async function createAdminAgent() {
  const email = uniqueEmail('admin');
  const admin = await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      role: 'ADMIN',
      passwordHash: await hashPassword(PASSWORD),
    },
  });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { agent, email, user: admin };
}

export async function employerWithCompany(companyName = 'Acme Labs') {
  const employer = await registerAgent('EMPLOYER', 'Erin Employer');
  await employer.agent.put('/api/companies/me').send({ name: companyName }).expect(200);
  return employer;
}

export function jobPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Backend Engineer',
    description: 'Build and operate the services behind our product.',
    requirements: 'Three years of Node.js experience.',
    responsibilities: 'Design APIs and review code.',
    location: 'Pune',
    jobType: 'FULL_TIME',
    workMode: 'HYBRID',
    experienceLevel: 'MID',
    salaryMin: 50000,
    salaryMax: 90000,
    skills: ['Node.js', 'PostgreSQL'],
    status: 'ACTIVE',
    ...overrides,
  };
}

export async function createJob(agent: Agent, overrides: Record<string, unknown> = {}) {
  const response = await agent.post('/api/jobs').send(jobPayload(overrides)).expect(201);
  return response.body.data as { id: string; status: JobStatus };
}

export const pdfBuffer = () => Buffer.from('%PDF-1.4\n%test resume\n%%EOF\n');

export async function uploadResume(agent: Agent) {
  await agent
    .post('/api/job-seekers/me/resume')
    .attach('resume', pdfBuffer(), { filename: 'cv.pdf', contentType: 'application/pdf' })
    .expect(201);
}

export async function seekerWithResume(name = 'Sam Seeker') {
  const seeker = await registerAgent('JOB_SEEKER', name);
  await uploadResume(seeker.agent);
  return seeker;
}

export async function applyTo(agent: Agent, jobId: string) {
  const response = await agent
    .post('/api/applications')
    .send({ jobId, coverLetter: 'I would like to join.' })
    .expect(201);
  return response.body.data as { id: string; status: ApplicationStatus };
}

export async function forceJobState(
  jobId: string,
  data: { status?: JobStatus; expiresAt?: Date | null },
) {
  await prisma.job.update({ where: { id: jobId }, data });
}
