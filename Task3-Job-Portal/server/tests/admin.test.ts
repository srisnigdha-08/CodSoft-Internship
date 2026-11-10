import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  app,
  applyTo,
  createAdminAgent,
  createJob,
  employerWithCompany,
  PASSWORD,
  registerAgent,
  resetDatabase,
  seekerWithResume,
} from './helpers.js';

describe('admin', () => {
  beforeEach(resetDatabase);

  it('reports platform statistics', async () => {
    const admin = await createAdminAgent();
    const employer = await employerWithCompany();
    const seeker = await seekerWithResume();
    const open = await createJob(employer.agent);
    await createJob(employer.agent, { status: 'DRAFT', title: 'Draft role' });
    await applyTo(seeker.agent, open.id);

    const res = await admin.agent.get('/api/admin/stats').expect(200);
    expect(res.body.data).toMatchObject({
      totalUsers: 3,
      totalJobSeekers: 1,
      totalEmployers: 1,
      totalJobs: 2,
      activeJobs: 1,
      totalApplications: 1,
    });
    expect(res.body.data.applicationsByStatus).toMatchObject({ APPLIED: 1, HIRED: 0 });
  });

  it('lists users without any password data and supports filters', async () => {
    const admin = await createAdminAgent();
    await registerAgent('EMPLOYER', 'Only Employer');
    await registerAgent('JOB_SEEKER', 'Only Seeker');
    const res = await admin.agent.get('/api/admin/users').query({ role: 'EMPLOYER' }).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Only Employer');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const searched = await admin.agent.get('/api/admin/users').query({ q: 'only seeker' }).expect(200);
    expect(searched.body.meta.total).toBe(1);
  });

  it('deactivates and reactivates users, but not its own account', async () => {
    const admin = await createAdminAgent();
    const { user, agent, email } = await registerAgent('JOB_SEEKER');
    await admin.agent.patch(`/api/admin/users/${user.id}/status`).send({ isActive: false }).expect(200);
    await agent.get('/api/auth/me').expect(401);
    await admin.agent.patch(`/api/admin/users/${user.id}/status`).send({ isActive: true }).expect(200);
    // The rejected session cookie was cleared, so a reactivated user signs in again.
    await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
    await agent.get('/api/auth/me').expect(200);
    await admin.agent
      .patch(`/api/admin/users/${admin.user.id}/status`)
      .send({ isActive: false })
      .expect(409);
    await admin.agent
      .patch(`/api/admin/users/${user.id}/status`)
      .send({ isActive: 'maybe' })
      .expect(422);
  });

  it('lists employers with their company and job count', async () => {
    const admin = await createAdminAgent();
    const employer = await employerWithCompany('Umbrella');
    await createJob(employer.agent);
    const res = await admin.agent.get('/api/admin/employers').expect(200);
    expect(res.body.data[0].company).toMatchObject({ name: 'Umbrella', jobCount: 1 });
  });

  it('moderates a job, blocks the employer from reviving it, then restores it', async () => {
    const admin = await createAdminAgent();
    const employer = await employerWithCompany();
    const job = await createJob(employer.agent);

    await admin.agent
      .patch(`/api/admin/jobs/${job.id}/moderation`)
      .send({ action: 'DEACTIVATE' })
      .expect(422);
    const moderated = await admin.agent
      .patch(`/api/admin/jobs/${job.id}/moderation`)
      .send({ action: 'DEACTIVATE', reason: 'Misleading posting' })
      .expect(200);
    expect(moderated.body.data.status).toBe('CLOSED');

    await request(app).get(`/api/jobs/${job.id}`).expect(404);
    const listed = await request(app).get('/api/jobs').expect(200);
    expect(listed.body.meta.total).toBe(0);
    await employer.agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'ACTIVE' }).expect(403);

    await admin.agent
      .patch(`/api/admin/jobs/${job.id}/moderation`)
      .send({ action: 'RESTORE' })
      .expect(200);
    await employer.agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'ACTIVE' }).expect(200);
    await request(app).get(`/api/jobs/${job.id}`).expect(200);
  });

  it('blocks applications to a moderated job', async () => {
    const admin = await createAdminAgent();
    const employer = await employerWithCompany();
    const seeker = await seekerWithResume();
    const job = await createJob(employer.agent);
    await admin.agent
      .patch(`/api/admin/jobs/${job.id}/moderation`)
      .send({ action: 'DEACTIVATE', reason: 'Spam' })
      .expect(200);
    await seeker.agent.post('/api/applications').send({ jobId: job.id }).expect(404);
  });

  it('lists all jobs and applications across employers', async () => {
    const admin = await createAdminAgent();
    const employer = await employerWithCompany();
    const seeker = await seekerWithResume();
    const job = await createJob(employer.agent);
    await createJob(employer.agent, { status: 'DRAFT', title: 'Draft role' });
    await applyTo(seeker.agent, job.id);

    const jobs = await admin.agent.get('/api/admin/jobs').expect(200);
    expect(jobs.body.meta.total).toBe(2);
    const drafts = await admin.agent.get('/api/admin/jobs').query({ status: 'DRAFT' }).expect(200);
    expect(drafts.body.meta.total).toBe(1);
    const byCompany = await admin.agent.get('/api/admin/jobs').query({ q: 'acme' }).expect(200);
    expect(byCompany.body.meta.total).toBe(2);
    const employers = await admin.agent.get('/api/admin/employers').query({ q: 'acme' }).expect(200);
    expect(employers.body.meta.total).toBe(1);
    const own = await employer.agent.get('/api/employers/me/jobs').query({ q: 'draft' }).expect(200);
    expect(own.body.meta.total).toBe(1);
    const applications = await admin.agent
      .get('/api/admin/applications')
      .query({ status: 'APPLIED', q: 'sam' })
      .expect(200);
    expect(applications.body.data[0].candidate.name).toBe('Sam Seeker');
    for (const q of ['backend', 'acme']) {
      const found = await admin.agent.get('/api/admin/applications').query({ q }).expect(200);
      expect(found.body.meta.total).toBe(1);
    }
    const none = await admin.agent.get('/api/admin/applications').query({ q: 'zzz' }).expect(200);
    expect(none.body.meta.total).toBe(0);
  });
});
