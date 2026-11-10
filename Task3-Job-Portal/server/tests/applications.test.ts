import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTo,
  createAdminAgent,
  createJob,
  employerWithCompany,
  forceJobState,
  registerAgent,
  resetDatabase,
  seekerWithResume,
  type Agent,
} from './helpers.js';

async function scenario() {
  const employer = await employerWithCompany();
  const seeker = await seekerWithResume();
  const job = await createJob(employer.agent);
  return { employer, seeker, job };
}

const move = (agent: Agent, id: string, status: string) =>
  agent.patch(`/api/applications/${id}/status`).send({ status });

describe('applying', () => {
  beforeEach(resetDatabase);

  it('creates an application with status APPLIED and an initial history entry', async () => {
    const { seeker, job } = await scenario();
    const application = await applyTo(seeker.agent, job.id);
    expect(application.status).toBe('APPLIED');
    const details = await seeker.agent.get(`/api/applications/${application.id}`).expect(200);
    expect(details.body.data.history).toHaveLength(1);
    expect(details.body.data.history[0]).toMatchObject({
      previousStatus: null,
      newStatus: 'APPLIED',
    });
    expect(details.body.data.resume.originalName).toBe('cv.pdf');
    expect(details.body.data.coverLetter).toBe('I would like to join.');
  });

  it('rejects a duplicate application', async () => {
    const { seeker, job } = await scenario();
    await applyTo(seeker.agent, job.id);
    const res = await seeker.agent.post('/api/applications').send({ jobId: job.id }).expect(409);
    expect(res.body.message).toMatch(/already applied/i);
  });

  it('settles simultaneous submissions into exactly one application', async () => {
    const { seeker, job } = await scenario();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => seeker.agent.post('/api/applications').send({ jobId: job.id })),
    );
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
  });

  it('rejects applications to closed, draft and missing jobs', async () => {
    const { seeker, employer, job } = await scenario();
    await forceJobState(job.id, { status: 'CLOSED' });
    await seeker.agent.post('/api/applications').send({ jobId: job.id }).expect(409);
    const draft = await createJob(employer.agent, { status: 'DRAFT' });
    await seeker.agent.post('/api/applications').send({ jobId: draft.id }).expect(409);
    await seeker.agent
      .post('/api/applications')
      .send({ jobId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
  });

  it('rejects applications after the deadline even before the expiry sweep runs', async () => {
    const { seeker, job } = await scenario();
    await forceJobState(job.id, { expiresAt: new Date(Date.now() - 1000) });
    const res = await seeker.agent.post('/api/applications').send({ jobId: job.id }).expect(409);
    expect(res.body.message).toMatch(/deadline/i);
  });

  it('requires a resume', async () => {
    const { job } = await scenario();
    const noResume = await registerAgent('JOB_SEEKER');
    const res = await noResume.agent.post('/api/applications').send({ jobId: job.id }).expect(422);
    expect(res.body.message).toMatch(/resume/i);
  });

  it('tells the job page whether the viewer already applied', async () => {
    const { seeker, job } = await scenario();
    const before = await seeker.agent.get(`/api/jobs/${job.id}`).expect(200);
    expect(before.body.data.viewerApplication).toBeNull();
    const application = await applyTo(seeker.agent, job.id);
    const after = await seeker.agent.get(`/api/jobs/${job.id}`).expect(200);
    expect(after.body.data.viewerApplication).toEqual({ id: application.id, status: 'APPLIED' });
  });

  it('lists only the candidate\'s own applications and filters by status', async () => {
    const { employer, seeker, job } = await scenario();
    const other = await seekerWithResume('Other');
    const second = await createJob(employer.agent, { title: 'Second role' });
    const mine = await applyTo(seeker.agent, job.id);
    await applyTo(seeker.agent, second.id);
    await applyTo(other.agent, job.id);
    await move(employer.agent, mine.id, 'UNDER_REVIEW').expect(200);

    const all = await seeker.agent.get('/api/applications').expect(200);
    expect(all.body.meta.total).toBe(2);
    const filtered = await seeker.agent
      .get('/api/applications')
      .query({ status: 'UNDER_REVIEW' })
      .expect(200);
    expect(filtered.body.data.map((a: { id: string }) => a.id)).toEqual([mine.id]);
  });
});

describe('application status', () => {
  beforeEach(resetDatabase);

  it('records previous status, new status, actor and time for each change', async () => {
    const { employer, seeker, job } = await scenario();
    const { id } = await applyTo(seeker.agent, job.id);
    await move(employer.agent, id, 'UNDER_REVIEW').expect(200);
    await move(employer.agent, id, 'SHORTLISTED').expect(200);
    await move(employer.agent, id, 'INTERVIEW').expect(200);
    const final = await move(employer.agent, id, 'HIRED').expect(200);

    const history = final.body.data.history as {
      previousStatus: string | null;
      newStatus: string;
      timestamp: string;
      changedBy: { role: string };
    }[];
    expect(history.map((h) => [h.previousStatus, h.newStatus])).toEqual([
      [null, 'APPLIED'],
      ['APPLIED', 'UNDER_REVIEW'],
      ['UNDER_REVIEW', 'SHORTLISTED'],
      ['SHORTLISTED', 'INTERVIEW'],
      ['INTERVIEW', 'HIRED'],
    ]);
    expect(history[1].changedBy.role).toBe('EMPLOYER');
    expect(Number.isNaN(Date.parse(history[1].timestamp))).toBe(false);
  });

  it.each([
    ['skipping stages', ['HIRED']],
    ['moving backwards', ['UNDER_REVIEW', 'APPLIED']],
    ['leaving a final status', ['REJECTED', 'UNDER_REVIEW']],
    ['employer withdrawing for the candidate', ['WITHDRAWN']],
  ])('rejects %s', async (_label, steps) => {
    const { employer, seeker, job } = await scenario();
    const { id } = await applyTo(seeker.agent, job.id);
    for (const step of steps.slice(0, -1)) {
      await move(employer.agent, id, step).expect(200);
    }
    await move(employer.agent, id, steps[steps.length - 1]).expect(409);
  });

  it('rejects unknown statuses', async () => {
    const { employer, seeker, job } = await scenario();
    const { id } = await applyTo(seeker.agent, job.id);
    await move(employer.agent, id, 'PROMOTED').expect(422);
  });

  it('lets a candidate withdraw once and records it', async () => {
    const { seeker, job } = await scenario();
    const { id } = await applyTo(seeker.agent, job.id);
    const res = await seeker.agent.post(`/api/applications/${id}/withdraw`).expect(200);
    expect(res.body.data.status).toBe('WITHDRAWN');
    expect(res.body.data.history.at(-1)).toMatchObject({
      previousStatus: 'APPLIED',
      newStatus: 'WITHDRAWN',
    });
    await seeker.agent.post(`/api/applications/${id}/withdraw`).expect(409);
  });

  it('does not allow withdrawing after a final decision', async () => {
    const { employer, seeker, job } = await scenario();
    const { id } = await applyTo(seeker.agent, job.id);
    await move(employer.agent, id, 'REJECTED').expect(200);
    await seeker.agent.post(`/api/applications/${id}/withdraw`).expect(409);
  });

  it('lets the employer see applicant summaries with skills and experience', async () => {
    const { employer, seeker, job } = await scenario();
    await seeker.agent.put('/api/job-seekers/me/skills').send({ skills: ['Rust'] }).expect(200);
    await seeker.agent
      .post('/api/job-seekers/me/experience')
      .send({
        company: 'Initech',
        jobTitle: 'Engineer',
        startDate: '2020-01-01',
        endDate: '2022-01-01',
      })
      .expect(201);
    await applyTo(seeker.agent, job.id);
    const res = await employer.agent.get(`/api/jobs/${job.id}/applications`).expect(200);
    expect(res.body.data[0].candidate).toMatchObject({
      name: 'Sam Seeker',
      skills: ['Rust'],
      experienceYears: 2,
      latestRole: 'Engineer at Initech',
    });
    expect(res.body.data[0].hasResume).toBe(true);
  });

  it('removes employer resume access once a candidate withdraws', async () => {
    const { employer, seeker, job } = await scenario();
    const { id } = await applyTo(seeker.agent, job.id);
    await employer.agent.get(`/api/applications/${id}/resume`).expect(200);
    await seeker.agent.post(`/api/applications/${id}/withdraw`).expect(200);
    await employer.agent.get(`/api/applications/${id}/resume`).expect(403);
    const details = await employer.agent.get(`/api/applications/${id}`).expect(200);
    expect(details.body.data.resume).toBeNull();
  });

  it('lets an admin read any application', async () => {
    const { seeker, job } = await scenario();
    const admin = await createAdminAgent();
    const { id } = await applyTo(seeker.agent, job.id);
    const res = await admin.agent.get(`/api/applications/${id}`).expect(200);
    expect(res.body.data.candidate.name).toBe('Sam Seeker');
  });
});
