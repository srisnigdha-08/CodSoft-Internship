import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  app,
  applyTo,
  createJob,
  employerWithCompany,
  forceJobState,
  jobPayload,
  registerAgent,
  resetDatabase,
  seekerWithResume,
} from './helpers.js';

const titles = (res: request.Response) => res.body.data.map((job: { title: string }) => job.title);

describe('job management', () => {
  beforeEach(resetDatabase);

  it('requires a company before posting', async () => {
    const { agent } = await registerAgent('EMPLOYER');
    const res = await agent.post('/api/jobs').send(jobPayload()).expect(422);
    expect(res.body.message).toMatch(/company profile/i);
  });

  it('creates a job with relational skills, ignoring duplicates by case', async () => {
    const { agent } = await employerWithCompany();
    const res = await agent
      .post('/api/jobs')
      .send(jobPayload({ skills: ['React', 'react ', 'TypeScript'] }))
      .expect(201);
    expect(res.body.data.skills).toHaveLength(2);
    expect(res.body.data.company.name).toBe('Acme Labs');
  });

  it.each([
    ['salary range', { salaryMin: 90000, salaryMax: 50000 }, 'salaryMax'],
    ['negative salary', { salaryMin: -5 }, 'salaryMin'],
    ['job type', { jobType: 'GIG' }, 'jobType'],
    ['work mode', { workMode: 'MOON' }, 'workMode'],
    ['empty skills', { skills: [] }, 'skills'],
    ['short title', { title: 'x' }, 'title'],
    ['bad deadline', { expiresAt: 'tomorrow' }, 'expiresAt'],
  ])('rejects invalid %s', async (_label, patch, field) => {
    const { agent } = await employerWithCompany();
    const res = await agent.post('/api/jobs').send(jobPayload(patch)).expect(422);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
  });

  it('rejects a deadline in the past', async () => {
    const { agent } = await employerWithCompany();
    await agent
      .post('/api/jobs')
      .send(jobPayload({ expiresAt: new Date(Date.now() - 1000).toISOString() }))
      .expect(422);
  });

  it('updates a job and replaces its skills', async () => {
    const { agent } = await employerWithCompany();
    const job = await createJob(agent);
    const res = await agent
      .put(`/api/jobs/${job.id}`)
      .send(jobPayload({ title: 'Staff Engineer', skills: ['Go'] }))
      .expect(200);
    expect(res.body.data.title).toBe('Staff Engineer');
    expect(res.body.data.skills).toEqual(['Go']);
  });

  it('moves a job through draft, active, deactivated and closed', async () => {
    const { agent } = await employerWithCompany();
    const job = await createJob(agent, { status: 'DRAFT' });
    expect(job.status).toBe('DRAFT');
    await request(app).get(`/api/jobs/${job.id}`).expect(404);

    const active = await agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'ACTIVE' }).expect(200);
    expect(active.body.data.publishedAt).toBeTruthy();
    await request(app).get(`/api/jobs/${job.id}`).expect(200);

    await agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'DRAFT' }).expect(200);
    await request(app).get(`/api/jobs/${job.id}`).expect(404);

    await agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'ACTIVE' }).expect(200);
    await agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'CLOSED' }).expect(200);
    const closed = await request(app).get(`/api/jobs/${job.id}`).expect(200);
    expect(closed.body.data.applicationsOpen).toBe(false);
  });

  it('rejects invalid job status changes', async () => {
    const { agent } = await employerWithCompany();
    const job = await createJob(agent);
    await agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'ACTIVE' }).expect(409);
    await agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'EXPIRED' }).expect(422);
    await agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'CLOSED' }).expect(200);
    await agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'DRAFT' }).expect(409);
  });

  it('will not reactivate a job whose deadline has passed', async () => {
    const { agent } = await employerWithCompany();
    const job = await createJob(agent);
    await forceJobState(job.id, { status: 'CLOSED', expiresAt: new Date(Date.now() - 1000) });
    await agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'ACTIVE' }).expect(422);
  });

  it('deletes a job only when it has no applications', async () => {
    const { agent } = await employerWithCompany();
    const seeker = await seekerWithResume();
    const empty = await createJob(agent, { title: 'Unused role' });
    const taken = await createJob(agent, { title: 'Popular role' });
    await applyTo(seeker.agent, taken.id);
    await agent.delete(`/api/jobs/${empty.id}`).expect(200);
    await agent.delete(`/api/jobs/${taken.id}`).expect(409);
  });
});

describe('job search', () => {
  beforeEach(async () => {
    await resetDatabase();
    const northwind = await employerWithCompany('Northwind');
    const globex = await employerWithCompany('Globex');
    await createJob(northwind.agent, {
      title: 'React Developer',
      location: 'Bengaluru',
      jobType: 'FULL_TIME',
      workMode: 'REMOTE',
      experienceLevel: 'MID',
      skills: ['React', 'CSS'],
    });
    await createJob(northwind.agent, {
      title: 'Data Analyst',
      location: 'Pune',
      jobType: 'CONTRACT',
      workMode: 'ONSITE',
      experienceLevel: 'ENTRY',
      skills: ['SQL'],
    });
    await createJob(globex.agent, {
      title: 'Platform Lead',
      location: 'Hyderabad',
      jobType: 'FULL_TIME',
      workMode: 'HYBRID',
      experienceLevel: 'LEAD',
      skills: ['Kubernetes'],
    });
    await createJob(globex.agent, { title: 'Hidden Draft', status: 'DRAFT' });
    const closed = await createJob(globex.agent, { title: 'Closed Role' });
    await forceJobState(closed.id, { status: 'CLOSED' });
    const expired = await createJob(globex.agent, { title: 'Lapsed Role' });
    await forceJobState(expired.id, { expiresAt: new Date(Date.now() - 1000) });
  });

  it('lists only open jobs', async () => {
    const res = await request(app).get('/api/jobs').expect(200);
    expect(res.body.meta.total).toBe(3);
    expect(titles(res)).not.toEqual(expect.arrayContaining(['Hidden Draft']));
    expect(titles(res)).not.toEqual(expect.arrayContaining(['Closed Role']));
    expect(titles(res)).not.toEqual(expect.arrayContaining(['Lapsed Role']));
  });

  it.each([
    ['title', 'data analyst', 'Data Analyst'],
    ['company', 'globex', 'Platform Lead'],
    ['skill', 'kubernetes', 'Platform Lead'],
    ['location', 'bengaluru', 'React Developer'],
  ])('searches by %s', async (_field, q, expected) => {
    const res = await request(app).get('/api/jobs').query({ q }).expect(200);
    expect(titles(res)).toEqual([expected]);
  });

  it.each([
    [{ jobType: 'CONTRACT' }, ['Data Analyst']],
    [{ workMode: 'REMOTE' }, ['React Developer']],
    [{ experienceLevel: 'LEAD' }, ['Platform Lead']],
    [{ location: 'pune' }, ['Data Analyst']],
    [{ skill: 'kubernetes' }, ['Platform Lead']],
    [{ q: 'northwind', workMode: 'REMOTE' }, ['React Developer']],
    [{ jobType: 'FULL_TIME', workMode: 'HYBRID' }, ['Platform Lead']],
  ])('filters by %o', async (query, expected) => {
    const res = await request(app).get('/api/jobs').query(query).expect(200);
    expect(titles(res)).toEqual(expected);
  });

  it('sorts newest and oldest', async () => {
    const newest = await request(app).get('/api/jobs').query({ sort: 'newest' }).expect(200);
    const oldest = await request(app).get('/api/jobs').query({ sort: 'oldest' }).expect(200);
    expect(titles(newest)).toEqual([...titles(oldest)].reverse());
  });

  it('paginates and caps the page size', async () => {
    const first = await request(app).get('/api/jobs').query({ limit: 2, page: 1 }).expect(200);
    const second = await request(app).get('/api/jobs').query({ limit: 2, page: 2 }).expect(200);
    expect(first.body.data).toHaveLength(2);
    expect(second.body.data).toHaveLength(1);
    expect(first.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    await request(app).get('/api/jobs').query({ limit: 5000 }).expect(422);
  });

  it('does not expose moderation or application counts publicly', async () => {
    const res = await request(app).get('/api/jobs').expect(200);
    expect(res.body.data[0].applicationCount).toBeUndefined();
    expect(res.body.data[0].moderationReason).toBeUndefined();
  });

  it('hides jobs of deactivated employers', async () => {
    const { prisma } = await import('./helpers.js');
    await prisma.user.updateMany({ where: { role: 'EMPLOYER' }, data: { isActive: false } });
    const res = await request(app).get('/api/jobs').expect(200);
    expect(res.body.meta.total).toBe(0);
  });
});
