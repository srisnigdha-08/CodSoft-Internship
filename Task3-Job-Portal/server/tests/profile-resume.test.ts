import { existsSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { sanitizeFilename } from '../src/utils/resumeFile.js';
import {
  applyTo,
  createJob,
  employerWithCompany,
  pdfBuffer,
  prisma,
  registerAgent,
  resetDatabase,
  uploadResume,
  type Agent,
} from './helpers.js';

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const upload = (agent: Agent, buffer: Buffer, filename: string, contentType: string) =>
  agent
    .post('/api/job-seekers/me/resume')
    .attach('resume', buffer, { filename, contentType });

describe('job seeker profile', () => {
  beforeEach(resetDatabase);

  it('updates profile fields', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    const res = await agent
      .put('/api/job-seekers/me')
      .send({
        name: 'Updated Name',
        phone: '+91 98765 43210',
        location: 'Chennai',
        headline: 'Engineer',
        summary: 'Builds things.',
      })
      .expect(200);
    expect(res.body.data).toMatchObject({ name: 'Updated Name', location: 'Chennai' });
    await agent.put('/api/job-seekers/me').send({ name: 'Ok Name', phone: 'abc' }).expect(422);
  });

  it('stores skills relationally without duplicates', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    const res = await agent
      .put('/api/job-seekers/me/skills')
      .send({ skills: ['TypeScript', 'typescript', 'C#'] })
      .expect(200);
    expect(res.body.data.skills).toEqual(['C#', 'typescript']);
    expect(await prisma.skill.count()).toBe(2);
  });

  it('manages education and validates dates', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    const entry = {
      institution: 'State University',
      degree: 'BSc',
      fieldOfStudy: 'Physics',
      startDate: '2019-01-01',
      endDate: '2022-01-01',
      grade: '8.5',
    };
    const created = await agent.post('/api/job-seekers/me/education').send(entry).expect(201);
    const id = created.body.data.id as string;
    await agent
      .put(`/api/job-seekers/me/education/${id}`)
      .send({ ...entry, degree: 'MSc' })
      .expect(200);
    await agent
      .post('/api/job-seekers/me/education')
      .send({ ...entry, endDate: '2018-01-01' })
      .expect(422);
    await agent.delete(`/api/job-seekers/me/education/${id}`).expect(200);
    const profile = await agent.get('/api/job-seekers/me').expect(200);
    expect(profile.body.data.education).toEqual([]);
  });

  it('manages experience and clears the end date for a current role', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    const res = await agent
      .post('/api/job-seekers/me/experience')
      .send({
        company: 'Initech',
        jobTitle: 'Developer',
        startDate: '2021-01-01',
        endDate: '2023-01-01',
        currentlyWorking: true,
      })
      .expect(201);
    expect(res.body.data.endDate).toBeNull();
    await agent
      .post('/api/job-seekers/me/experience')
      .send({ company: 'Initech', jobTitle: 'Developer', startDate: '2021-01-01' })
      .expect(422);
  });

  it('computes dashboard completion from real profile data', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    const empty = await agent.get('/api/job-seekers/me/dashboard').expect(200);
    expect(empty.body.data.profileCompletion).toBe(0);
    await uploadResume(agent);
    const after = await agent.get('/api/job-seekers/me/dashboard').expect(200);
    expect(after.body.data.profileCompletion).toBe(13);
  });
});

describe('employer and company profile', () => {
  beforeEach(resetDatabase);

  it('creates then updates a single company per employer', async () => {
    const { agent } = await registerAgent('EMPLOYER');
    const first = await agent.put('/api/companies/me').send({ name: 'First Name' }).expect(200);
    const second = await agent
      .put('/api/companies/me')
      .send({ name: 'Second Name', website: 'https://example.com' })
      .expect(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await prisma.company.count()).toBe(1);
    await agent.put('/api/companies/me').send({ name: 'Ok', website: 'javascript:alert(1)' }).expect(422);
  });

  it('reports employer dashboard numbers', async () => {
    const { agent } = await employerWithCompany();
    await createJob(agent);
    await createJob(agent, { status: 'DRAFT', title: 'Draft role' });
    const res = await agent.get('/api/employers/me/dashboard').expect(200);
    expect(res.body.data).toMatchObject({ totalJobs: 2, activeJobs: 1, closedJobs: 0 });
  });
});

describe('resume upload', () => {
  beforeEach(resetDatabase);

  it('stores a PDF under a generated name and returns no server path', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    const res = await upload(agent, pdfBuffer(), 'My CV.pdf', 'application/pdf').expect(201);
    expect(res.body.data.originalName).toBe('My CV.pdf');
    expect(res.body.data.storedName).toBeUndefined();
    const row = await prisma.resume.findFirstOrThrow();
    expect(row.storedName).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(existsSync(path.join(env.uploadDir, row.storedName))).toBe(true);
  });

  it('accepts DOC and DOCX with matching content', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    const doc = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(32),
    ]);
    const docx = Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.from('word/document.xml')]);
    await upload(agent, doc, 'cv.doc', 'application/msword').expect(201);
    await upload(agent, docx, 'cv.docx', DOCX_TYPE).expect(201);
  });

  it.each([
    ['executable', Buffer.from('MZ-binary'), 'run.exe', 'application/octet-stream'],
    ['double extension', Buffer.from('MZ-binary'), 'cv.pdf.exe', 'application/pdf'],
    ['script as PDF', Buffer.from('<script>alert(1)</script>'), 'cv.pdf', 'application/pdf'],
    ['wrong MIME type', pdfBuffer(), 'cv.pdf', 'text/html'],
    ['plain zip as DOCX', Buffer.from('PK\u0003\u0004other'), 'cv.docx', DOCX_TYPE],
    ['empty file', Buffer.alloc(0), 'cv.pdf', 'application/pdf'],
  ])('rejects %s', async (_label, buffer, filename, contentType) => {
    const { agent } = await registerAgent('JOB_SEEKER');
    await upload(agent, buffer, filename, contentType).expect(422);
    expect(await prisma.resume.count()).toBe(0);
  });

  it('rejects files over the size limit', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    const big = Buffer.concat([pdfBuffer(), Buffer.alloc(env.maxResumeBytes + 1)]);
    await upload(agent, big, 'cv.pdf', 'application/pdf').expect(413);
  });

  it('rejects a request with no file', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    await agent.post('/api/job-seekers/me/resume').expect(422);
  });

  it('strips path components from file names', () => {
    expect(sanitizeFilename('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(sanitizeFilename('..\\..\\windows\\cv.pdf')).toBe('cv.pdf');
    expect(sanitizeFilename('c<v>.pdf')).toBe('cv.pdf');
  });

  it('replaces a resume and deletes the unused old file', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    await upload(agent, pdfBuffer(), 'first.pdf', 'application/pdf').expect(201);
    const first = await prisma.resume.findFirstOrThrow();
    await upload(agent, pdfBuffer(), 'second.pdf', 'application/pdf').expect(201);
    expect(await prisma.resume.count()).toBe(1);
    expect(existsSync(path.join(env.uploadDir, first.storedName))).toBe(false);
    const current = await agent.get('/api/job-seekers/me/resume').expect(200);
    expect(current.body.data.originalName).toBe('second.pdf');
  });

  it('keeps the submitted resume for an application after replacement', async () => {
    const employer = await employerWithCompany();
    const job = await createJob(employer.agent);
    const { agent } = await registerAgent('JOB_SEEKER');
    await upload(agent, pdfBuffer(), 'submitted.pdf', 'application/pdf').expect(201);
    const { id } = await applyTo(agent, job.id);
    await upload(agent, pdfBuffer(), 'newer.pdf', 'application/pdf').expect(201);
    const details = await employer.agent.get(`/api/applications/${id}`).expect(200);
    expect(details.body.data.resume.originalName).toBe('submitted.pdf');
  });

  it('serves the owner a download with safe headers', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    await uploadResume(agent);
    const res = await agent.get('/api/job-seekers/me/resume/file').expect(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment/);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    const inline = await agent.get('/api/job-seekers/me/resume/file?view=1').expect(200);
    expect(inline.headers['content-disposition']).toMatch(/^inline/);
  });

  it('removes a resume', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    await uploadResume(agent);
    await agent.delete('/api/job-seekers/me/resume').expect(200);
    await agent.get('/api/job-seekers/me/resume/file').expect(404);
  });
});
