import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AUTH_COOKIE, signToken } from '../src/utils/token.js';
import { app, createAdminAgent, PASSWORD, prisma, registerAgent, resetDatabase } from './helpers.js';

const valid = {
  name: 'New Person',
  email: 'new.person@example.com',
  password: PASSWORD,
  role: 'JOB_SEEKER',
};

const cookieHeader = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[])[0];

describe('authentication', () => {
  beforeEach(resetDatabase);

  it('registers a user, hashes the password and never returns the hash', async () => {
    const res = await request(app).post('/api/auth/register').send(valid).expect(201);
    expect(res.body.success).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: valid.email } });
    expect(stored.passwordHash).not.toBe(PASSWORD);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    const profile = await prisma.jobSeekerProfile.findUnique({ where: { userId: stored.id } });
    expect(profile).not.toBeNull();
  });

  it('sets an HttpOnly SameSite=Strict cookie and does not return the token in the body', async () => {
    const res = await request(app).post('/api/auth/register').send(valid).expect(201);
    const cookie = cookieHeader(res);
    expect(cookie).toContain(`${AUTH_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(JSON.stringify(res.body)).not.toContain(cookie.split('=')[1].split(';')[0]);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await request(app).post('/api/auth/register').send(valid).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, email: valid.email.toUpperCase() })
      .expect(409);
    expect(res.body).toEqual({
      success: false,
      message: 'An account with this email already exists',
    });
  });

  it.each([
    ['bad email', { email: 'nope' }, 'email'],
    ['weak password', { password: 'short' }, 'password'],
    ['password without digit', { password: 'NoDigitsHere' }, 'password'],
    ['missing name', { name: '' }, 'name'],
    ['admin self-registration', { role: 'ADMIN' }, 'role'],
  ])('rejects registration with %s', async (_label, patch, field) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, ...patch })
      .expect(422);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(field);
  });

  it('logs in with valid credentials', async () => {
    await request(app).post('/api/auth/register').send(valid).expect(201);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: PASSWORD })
      .expect(200);
    expect(res.body.data.email).toBe(valid.email);
    expect(cookieHeader(res)).toMatch(/HttpOnly/i);
  });

  it('returns the same error for a wrong password and an unknown email', async () => {
    await request(app).post('/api/auth/register').send(valid).expect(201);
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: 'Wrong1234' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'Wrong1234' })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('returns the current user for an authenticated session', async () => {
    const { agent, email } = await registerAgent('EMPLOYER');
    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.role).toBe('EMPLOYER');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('rejects unauthenticated, tampered and foreign tokens', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Cookie', `${AUTH_COOKIE}=not-a-token`).expect(401);
    const unknownUser = signToken('00000000-0000-4000-8000-000000000000');
    await request(app).get('/api/auth/me').set('Cookie', `${AUTH_COOKIE}=${unknownUser}`).expect(401);
  });

  it('ends the session on logout', async () => {
    const { agent } = await registerAgent('JOB_SEEKER');
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });

  it('blocks login and existing sessions for deactivated users', async () => {
    const { agent, email, user } = await registerAgent('JOB_SEEKER');
    const admin = await createAdminAgent();
    await admin.agent.patch(`/api/admin/users/${user.id}/status`).send({ isActive: false }).expect(200);
    await agent.get('/api/auth/me').expect(401);
    await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(403);
  });

  it('changes the password only with the correct current password', async () => {
    const { agent, email } = await registerAgent('JOB_SEEKER');
    await agent
      .post('/api/users/me/password')
      .send({ currentPassword: 'Wrong1234', newPassword: 'Another123' })
      .expect(401);
    await agent
      .post('/api/users/me/password')
      .send({ currentPassword: PASSWORD, newPassword: 'Another123' })
      .expect(200);
    await request(app).post('/api/auth/login').send({ email, password: 'Another123' }).expect(200);
  });

  it('rate limits repeated login attempts', async () => {
    const limited = createApp({ authRateLimitMax: 3 });
    const attempt = () =>
      request(limited).post('/api/auth/login').send({ email: 'a@example.com', password: 'x' });
    await attempt().expect(401);
    await attempt().expect(401);
    await attempt().expect(401);
    const res = await attempt().expect(429);
    expect(res.body.success).toBe(false);
  });
});

describe('platform behaviour', () => {
  beforeEach(resetDatabase);

  it('reports health with database connectivity and no connection details', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'connected' });
  });

  it('allows only the configured CORS origin', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers malformed JSON with 400 and unknown routes with 404', async () => {
    const malformed = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(malformed.body).toEqual({ success: false, message: 'Malformed JSON body' });
    const missing = await request(app).get('/api/does-not-exist').expect(404);
    expect(missing.body.success).toBe(false);
  });

  it('rejects malformed identifiers without leaking internals', async () => {
    const res = await request(app).get('/api/jobs/not-a-uuid').expect(422);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|stack|at .*\.ts/i);
  });
});
