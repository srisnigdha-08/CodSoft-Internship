import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { User, Vendor } from '../src/models/index.js';
import { app, createAccount, PASSWORD, useTestDatabase } from './helpers/harness.js';

useTestDatabase();

const customerBody = {
  accountType: 'CUSTOMER',
  name: 'New Customer',
  email: 'new@test.example',
  password: 'StrongPass1',
};

const vendorBody = {
  accountType: 'VENDOR',
  name: 'New Vendor',
  email: 'seller@test.example',
  password: 'StrongPass1',
  vendor: {
    businessName: 'New Store',
    address: { line1: '1 Market Road', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001' },
  },
};

describe('registration', () => {
  it('creates a customer, hashes the password and sets an HttpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(customerBody).expect(201);
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^marketplace_token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const stored = await User.findOne({ email: customerBody.email }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toContain(customerBody.password);
  });

  it('never returns the token in the response body', async () => {
    const res = await request(app).post('/api/auth/register').send(customerBody).expect(201);
    expect(JSON.stringify(res.body)).not.toContain('token');
  });

  it('creates vendor accounts as PENDING', async () => {
    const res = await request(app).post('/api/auth/register').send(vendorBody).expect(201);
    expect(res.body.user.role).toBe('VENDOR');
    expect(res.body.vendor.approvalStatus).toBe('PENDING');
  });

  it('removes the user again when the vendor profile cannot be created', async () => {
    await request(app).post('/api/auth/register').send(vendorBody).expect(201);
    await request(app)
      .post('/api/auth/register')
      .send({ ...vendorBody, email: 'second@test.example' })
      .expect(409);
    expect(await User.countDocuments({ email: 'second@test.example' })).toBe(0);
    expect(await Vendor.countDocuments()).toBe(1);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await request(app).post('/api/auth/register').send(customerBody).expect(201);
    await request(app)
      .post('/api/auth/register')
      .send({ ...customerBody, email: 'NEW@test.example' })
      .expect(409);
  });

  it('does not allow self-registration as admin', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...customerBody, accountType: 'ADMIN' })
      .expect(422);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...customerBody, role: 'ADMIN' })
      .expect(201);
    expect(res.body.user.role).toBe('CUSTOMER');
  });

  it('rejects weak passwords and malformed emails with 422', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...customerBody, password: 'short' })
      .expect(422);
    await request(app)
      .post('/api/auth/register')
      .send({ ...customerBody, email: 'not-an-email' })
      .expect(422);
  });
});

describe('login and session', () => {
  it('logs in, reads the session and logs out', async () => {
    const { agent, email } = await createAccount('CUSTOMER');
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe(email);
    expect(me.body.user.passwordHash).toBeUndefined();

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('rejects wrong and unknown credentials with the same message', async () => {
    const { email } = await createAccount('CUSTOMER');
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPass1' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.example', password: PASSWORD })
      .expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('rejects NoSQL operator objects in credentials', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } })
      .expect(422);
  });

  it('rejects requests with no token, a forged token or a none-algorithm token', async () => {
    await request(app).get('/api/auth/me').expect(401);
    const { userId } = await createAccount('ADMIN');
    const forged = jwt.sign({ role: 'ADMIN' }, 'x'.repeat(40), { subject: userId.toString() });
    await request(app).get('/api/auth/me').set('Cookie', `marketplace_token=${forged}`).expect(401);
    const none = jwt.sign({ role: 'ADMIN' }, '', { algorithm: 'none', subject: userId.toString() });
    await request(app).get('/api/auth/me').set('Cookie', `marketplace_token=${none}`).expect(401);
  });

  it('blocks a deactivated user immediately, even with a valid token', async () => {
    const { agent, userId, email } = await createAccount('CUSTOMER');
    await User.updateOne({ _id: userId }, { status: 'DEACTIVATED' });
    await agent.get('/api/auth/me').expect(403);
    await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(403);
  });

  it('rate limits repeated login attempts', async () => {
    const limited = createApp({ authRateLimitMax: 2 });
    const attempt = () =>
      request(limited).post('/api/auth/login').send({ email: 'a@test.example', password: 'x' });
    await attempt().expect(401);
    await attempt().expect(401);
    await attempt().expect(429);
  });
});

describe('platform safeguards', () => {
  it('reports a healthy database without exposing configuration', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'connected' });
  });

  it('allows the configured origin and refuses others', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5184').expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5184');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    await request(app).get('/api/health').set('Origin', 'https://evil.example').expect(403);
  });

  it('returns structured errors for malformed JSON, unknown routes and bad ids', async () => {
    const malformed = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ nope')
      .expect(400);
    expect(malformed.body.error.code).toBe('BAD_REQUEST');
    expect(JSON.stringify(malformed.body)).not.toMatch(/at .*\.js/);

    await request(app).get('/api/does-not-exist').expect(404);
    await request(app).get('/api/products/not-an-id').expect(400);
  });
});
