import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category, Product, User, Vendor } from '../src/models/index.js';
import {
  app,
  createAccount,
  createCategory,
  createProduct,
  createVendor,
  multiVendorScenario,
  placePaidOrder,
  useTestDatabase,
} from './helpers/harness.js';

useTestDatabase();

describe('admin authorization', () => {
  const adminGetRoutes = ['/dashboard', '/vendors', '/users', '/categories', '/products', '/orders'];

  it.each(adminGetRoutes)('denies %s to non-admins', async (route) => {
    await request(app).get(`/api/admin${route}`).expect(401);
    const customer = await createAccount('CUSTOMER');
    await customer.agent.get(`/api/admin${route}`).expect(403);
    const vendor = await createVendor();
    await vendor.agent.get(`/api/admin${route}`).expect(403);
  });

  it('denies category writes to non-admins', async () => {
    const vendor = await createVendor();
    await vendor.agent.post('/api/categories').send({ name: 'Sneaky' }).expect(403);
  });
});

describe('vendor approval', () => {
  it('approves a pending vendor, who can then sell', async () => {
    const admin = await createAccount('ADMIN');
    const vendor = await createVendor('PENDING');
    const category = await createCategory();
    const body = {
      name: 'First Product',
      description: 'A product awaiting its store approval.',
      price: 100,
      stock: 1,
      sku: 'FIRST-1',
      categoryId: category.id,
    };
    await vendor.agent.post('/api/products').send(body).expect(403);

    const res = await admin.agent
      .patch(`/api/admin/vendors/${vendor.vendorId}/status`)
      .send({ status: 'APPROVED' })
      .expect(200);
    expect(res.body.vendor.approvalStatus).toBe('APPROVED');
    await vendor.agent.post('/api/products').send(body).expect(201);
  });

  it('supports reject, suspend and reactivate', async () => {
    const admin = await createAccount('ADMIN');
    const rejected = await createVendor('PENDING');
    const setStatus = (id: unknown, status: string) =>
      admin.agent.patch(`/api/admin/vendors/${String(id)}/status`).send({ status, note: 'Reviewed' });
    await setStatus(rejected.vendorId, 'REJECTED').expect(200);
    expect((await Vendor.findById(rejected.vendorId))?.approvalNote).toBe('Reviewed');

    const active = await createVendor('APPROVED');
    await setStatus(active.vendorId, 'SUSPENDED').expect(200);
    await setStatus(active.vendorId, 'APPROVED').expect(200);
  });

  it('rejects invalid approval transitions', async () => {
    const admin = await createAccount('ADMIN');
    const pending = await createVendor('PENDING');
    await admin.agent.patch(`/api/admin/vendors/${pending.vendorId}/status`).send({ status: 'SUSPENDED' }).expect(409);
    await admin.agent.patch(`/api/admin/vendors/${pending.vendorId}/status`).send({ status: 'NOPE' }).expect(422);
  });

  it('hides a suspended vendor\'s products at once', async () => {
    const admin = await createAccount('ADMIN');
    const vendor = await createVendor();
    const category = await createCategory();
    const product = await createProduct(vendor.vendorId, category._id);
    await request(app).get(`/api/products/${product.id}`).expect(200);
    await admin.agent.patch(`/api/admin/vendors/${vendor.vendorId}/status`).send({ status: 'SUSPENDED' }).expect(200);
    await request(app).get(`/api/products/${product.id}`).expect(404);
  });

  it('filters vendors by status and returns the owner without secrets', async () => {
    const admin = await createAccount('ADMIN');
    await createVendor('PENDING');
    await createVendor('APPROVED');
    const { body } = await admin.agent.get('/api/admin/vendors').query({ status: 'PENDING' }).expect(200);
    expect(body.total).toBe(1);
    expect(body.items[0].owner.email).toBeDefined();
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });
});

describe('user management', () => {
  it('lists users without password hashes', async () => {
    const admin = await createAccount('ADMIN');
    await createAccount('CUSTOMER');
    const { body } = await admin.agent.get('/api/admin/users').expect(200);
    expect(body.total).toBe(2);
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('prevents changing your own role or status', async () => {
    const admin = await createAccount('ADMIN');
    await admin.agent.patch(`/api/admin/users/${admin.userId}`).send({ role: 'CUSTOMER' }).expect(403);
    await admin.agent.patch(`/api/admin/users/${admin.userId}`).send({ status: 'DEACTIVATED' }).expect(403);
    expect(await User.findById(admin.userId).lean()).toMatchObject({ role: 'ADMIN', status: 'ACTIVE' });
  });

  it('changes permitted roles and deactivates users', async () => {
    const admin = await createAccount('ADMIN');
    const customer = await createAccount('CUSTOMER');
    await admin.agent.patch(`/api/admin/users/${customer.userId}`).send({ role: 'ADMIN' }).expect(200);
    await admin.agent.patch(`/api/admin/users/${customer.userId}`).send({ role: 'CUSTOMER', status: 'DEACTIVATED' }).expect(200);
    await customer.agent.get('/api/auth/me').expect(403);
  });

  it('refuses vendor role changes and role VENDOR assignment', async () => {
    const admin = await createAccount('ADMIN');
    const vendor = await createVendor();
    const customer = await createAccount('CUSTOMER');
    await admin.agent.patch(`/api/admin/users/${vendor.userId}`).send({ role: 'ADMIN' }).expect(400);
    await admin.agent.patch(`/api/admin/users/${customer.userId}`).send({ role: 'VENDOR' }).expect(422);
  });

  it('suspends the store when its owner is deactivated', async () => {
    const admin = await createAccount('ADMIN');
    const vendor = await createVendor();
    await admin.agent.patch(`/api/admin/users/${vendor.userId}`).send({ status: 'DEACTIVATED' }).expect(200);
    expect((await Vendor.findById(vendor.vendorId))?.approvalStatus).toBe('SUSPENDED');
  });

  it('does not let users escalate through their profile', async () => {
    const customer = await createAccount('CUSTOMER');
    const res = await customer.agent.patch('/api/users/me').send({ name: 'Renamed', role: 'ADMIN' }).expect(200);
    expect(res.body.user).toMatchObject({ name: 'Renamed', role: 'CUSTOMER' });
  });
});

describe('category and product management', () => {
  it('creates, edits and deactivates categories, case-insensitively unique', async () => {
    const admin = await createAccount('ADMIN');
    const created = await admin.agent.post('/api/categories').send({ name: 'Garden' }).expect(201);
    await admin.agent.post('/api/categories').send({ name: 'GARDEN' }).expect(409);

    const id = created.body.category._id;
    await admin.agent.patch(`/api/categories/${id}`).send({ description: 'Plants' }).expect(200);
    await admin.agent.patch(`/api/categories/${id}`).send({ isActive: false }).expect(200);

    const open = await request(app).get('/api/categories').expect(200);
    expect(open.body.items).toHaveLength(0);
    expect((await admin.agent.get('/api/admin/categories')).body.items).toHaveLength(1);
    expect(await Category.countDocuments()).toBe(1);
  });

  it('can deactivate any product and see inactive products', async () => {
    const admin = await createAccount('ADMIN');
    const vendor = await createVendor();
    const category = await createCategory();
    const product = await createProduct(vendor.vendorId, category._id);
    await admin.agent.patch(`/api/products/${product.id}`).send({ isActive: false }).expect(200);
    expect((await Product.findById(product.id))?.isActive).toBe(false);
    const { body } = await admin.agent.get('/api/admin/products').expect(200);
    expect(body.total).toBe(1);
  });
});

describe('marketplace overview', () => {
  it('shows complete orders and accurate statistics', async () => {
    const admin = await createAccount('ADMIN');
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await createVendor('PENDING');

    const dashboard = await admin.agent.get('/api/admin/dashboard').expect(200);
    expect(dashboard.body).toMatchObject({ vendors: 3, pendingVendors: 1, products: 2, orders: 1, revenue: 2596 });

    const list = await admin.agent.get('/api/admin/orders').expect(200);
    expect(list.body.items[0].vendorOrders).toHaveLength(2);
    expect(list.body.items[0].contact.fullName).toBe('Test Customer');

    const detail = await admin.agent.get(`/api/orders/${orderId}`).expect(200);
    expect(detail.body.payment.status).toBe('PAID');
    expect(detail.body.order.grandTotal).toBe(2596);
  });

  it('nets refunds out of revenue', async () => {
    const admin = await createAccount('ADMIN');
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await scenario.vendorA.agent.patch(`/api/vendors/me/orders/${orderId}/status`).send({ status: 'CANCELLED' }).expect(200);
    const { body } = await admin.agent.get('/api/admin/dashboard').expect(200);
    expect(body.revenue).toBe(1416);
  });
});
