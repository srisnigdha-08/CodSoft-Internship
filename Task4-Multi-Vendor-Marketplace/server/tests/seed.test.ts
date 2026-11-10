import bcrypt from 'bcrypt';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { databaseNameOf, resolveDatabaseUri, TEST_DATABASE_NAME } from '../src/config/env.js';
import { Order, Product, User, Vendor } from '../src/models/index.js';
import { DEMO_PASSWORDS } from '../src/seed/data.js';
import { runSeed } from '../src/seed/seed.js';
import { app, useTestDatabase } from './helpers/harness.js';

useTestDatabase();

describe('test isolation', () => {
  it('only ever resolves the dedicated test database', () => {
    expect(databaseNameOf(resolveDatabaseUri())).toBe(TEST_DATABASE_NAME);
  });
});

describe('seed', () => {
  it('is idempotent and leaves development changes in place', async () => {
    const first = await runSeed();
    expect(first).toMatchObject({ categories: 7, vendors: 6, orders: 4, payments: 4, reviews: 5 });

    const product = await Product.findOne({ sku: 'AUR-HP-01' }).orFail();
    await Product.updateOne({ _id: product._id }, { price: 1234 });
    const originalAdminHash = (await User.findOne({ email: 'admin@example.com' }).select('+passwordHash'))?.passwordHash;

    const second = await runSeed();
    expect(second).toEqual(first);
    expect((await Product.findById(product._id))?.price).toBe(1234);
    expect((await User.findOne({ email: 'admin@example.com' }).select('+passwordHash'))?.passwordHash).toBe(originalAdminHash);
  });

  it('stores hashed demo passwords that work for login', async () => {
    await runSeed();
    const admin = await User.findOne({ email: 'admin@example.com' }).select('+passwordHash').orFail();
    expect(await bcrypt.compare(DEMO_PASSWORDS.ADMIN, admin.passwordHash)).toBe(true);
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'vendor1@example.com', password: DEMO_PASSWORDS.VENDOR })
      .expect(200);
  });

  it('seeds real multi-vendor orders and every vendor state', async () => {
    await runSeed();
    const order = await Order.findOne({ orderNumber: 'MKT-DEMO-0001' }).lean();
    expect(order?.vendorOrders).toHaveLength(2);
    expect(Date.now() - order!.createdAt.getTime()).toBeGreaterThan(11 * 86_400_000);
    const statuses = await Vendor.distinct('approvalStatus');
    expect(statuses.sort()).toEqual(['APPROVED', 'PENDING', 'SUSPENDED']);
    const res = await request(app).get('/api/products').query({ limit: 48 }).expect(200);
    expect(res.body.total).toBe(28);
    expect(new Set(res.body.items.map((p: { vendor: { _id: string } }) => p.vendor._id)).size).toBe(4);
  });
});
