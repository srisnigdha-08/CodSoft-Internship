import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  app,
  applyTo,
  createAdminAgent,
  createJob,
  employerWithCompany,
  jobPayload,
  registerAgent,
  resetDatabase,
  seekerWithResume,
} from './helpers.js';

const education = {
  institution: 'State University',
  degree: 'BSc',
  fieldOfStudy: 'Computer Science',
  startDate: '2018-07-01',
  endDate: '2021-05-30',
};

describe('role-based access control', () => {
  beforeEach(resetDatabase);

  it('stops a job seeker from creating a job', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    await agent.post('/api/jobs').send(jobPayload()).expect(403);
  });

  it('stops anonymous users from creating jobs or applying', async () => {
    await request(app).post('/api/jobs').send(jobPayload()).expect(401);
    await request(app)
      .post('/api/applications')
      .send({ jobId: '00000000-0000-4000-8000-000000000000' })
      .expect(401);
  });

  it.each(['/stats', '/users', '/employers', '/jobs', '/applications'])(
    'stops non-admins from reading /api/admin%s',
    async (path) => {
      const employer = await registerAgent('EMPLOYER');
      const seeker = await registerAgent('JOB_SEEKER');
      await request(app).get(`/api/admin${path}`).expect(401);
      await employer.agent.get(`/api/admin${path}`).expect(403);
      await seeker.agent.get(`/api/admin${path}`).expect(403);
    },
  );

  it('stops an employer from changing another employer\'s job', async () => {
    const owner = await employerWithCompany('Owner Co');
    const other = await employerWithCompany('Other Co');
    const job = await createJob(owner.agent);
    await other.agent.put(`/api/jobs/${job.id}`).send(jobPayload({ title: 'Hijacked' })).expect(403);
    await other.agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'CLOSED' }).expect(403);
    await other.agent.delete(`/api/jobs/${job.id}`).expect(403);
    await other.agent.get(`/api/jobs/${job.id}/applications`).expect(403);
  });

  it('stops an employer from seeing another employer\'s applications and resumes', async () => {
    const owner = await employerWithCompany('Owner Co');
    const other = await employerWithCompany('Other Co');
    const seeker = await seekerWithResume();
    const job = await createJob(owner.agent);
    const application = await applyTo(seeker.agent, job.id);
    await other.agent.get(`/api/applications/${application.id}`).expect(403);
    await other.agent.get(`/api/applications/${application.id}/resume`).expect(403);
    await other.agent
      .patch(`/api/applications/${application.id}/status`)
      .send({ status: 'UNDER_REVIEW' })
      .expect(403);
  });

  it('stops a candidate from reading or withdrawing another candidate\'s application', async () => {
    const employer = await employerWithCompany();
    const first = await seekerWithResume('First');
    const second = await seekerWithResume('Second');
    const job = await createJob(employer.agent);
    const application = await applyTo(first.agent, job.id);
    await second.agent.get(`/api/applications/${application.id}`).expect(403);
    await second.agent.post(`/api/applications/${application.id}/withdraw`).expect(403);
    await second.agent.get(`/api/applications/${application.id}/resume`).expect(403);
  });

  it('stops a candidate from editing another candidate\'s profile entries', async () => {
    const first = await registerAgent('JOB_SEEKER');
    const second = await registerAgent('JOB_SEEKER');
    const created = await first.agent.post('/api/job-seekers/me/education').send(education).expect(201);
    const id = created.body.data.id as string;
    await second.agent
      .put(`/api/job-seekers/me/education/${id}`)
      .send({ ...education, degree: 'Changed' })
      .expect(404);
    await second.agent.delete(`/api/job-seekers/me/education/${id}`).expect(404);
    const profile = await first.agent.get('/api/job-seekers/me').expect(200);
    expect(profile.body.data.education[0].degree).toBe('BSc');
  });

  it('stops a job seeker from changing application status', async () => {
    const employer = await employerWithCompany();
    const seeker = await seekerWithResume();
    const job = await createJob(employer.agent);
    const application = await applyTo(seeker.agent, job.id);
    await seeker.agent
      .patch(`/api/applications/${application.id}/status`)
      .send({ status: 'HIRED' })
      .expect(403);
  });

  it('stops employers from applying and from using job seeker APIs', async () => {
    const owner = await employerWithCompany();
    const job = await createJob(owner.agent);
    await owner.agent.post('/api/applications').send({ jobId: job.id }).expect(403);
    await owner.agent.get('/api/job-seekers/me').expect(403);
  });

  it('ignores identity fields supplied by the client', async () => {
    const employer = await employerWithCompany();
    const seeker = await seekerWithResume('Real Applicant');
    const victim = await seekerWithResume('Victim');
    const job = await createJob(employer.agent);
    const res = await seeker.agent
      .post('/api/applications')
      .send({ jobId: job.id, userId: victim.user.id, candidateId: victim.user.id })
      .expect(201);
    const details = await employer.agent.get(`/api/applications/${res.body.data.id}`).expect(200);
    expect(details.body.data.candidate.name).toBe('Real Applicant');
  });

  it('lets an admin manage any job', async () => {
    const owner = await employerWithCompany();
    const admin = await createAdminAgent();
    const job = await createJob(owner.agent);
    await admin.agent.patch(`/api/jobs/${job.id}/status`).send({ status: 'CLOSED' }).expect(200);
  });
});
