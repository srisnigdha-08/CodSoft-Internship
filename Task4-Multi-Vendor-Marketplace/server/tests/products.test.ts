import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category, Product } from '../src/models/index.js';
import {
  app,
  createAccount,
  createCategory,
  createProduct,
  createVendor,
  useTestDatabase,
} from './helpers/harness.js';

useTestDatabase();

const productBody = (categoryId: string, overrides = {}) => ({
  name: 'Ceramic Teapot',
  description: 'A hand thrown ceramic teapot.',
  price: 899.5,
  stock: 12,
  sku: 'tea-001',
  categoryId,
  images: ['/catalog/teapot.svg'],
  ...overrides,
});

describe('vendor product management', () => {
  it('lets an approved vendor create a product owned by their store', async () => {
    const vendor = await createVendor();
    const other = await createVendor();
    const category = await createCategory();
    const res = await vendor.agent
      .post('/api/products')
      .send(productBody(category.id, { vendorId: other.vendorId.toString() }))
      .expect(201);
    expect(res.body.product.vendorId).toBe(vendor.vendorId.toString());
    expect(res.body.product.sku).toBe('TEA-001');
  });

  it.each(['PENDING', 'REJECTED', 'SUSPENDED'] as const)('blocks a %s vendor', async (status) => {
    const vendor = await createVendor(status);
    const category = await createCategory();
    await vendor.agent.post('/api/products').send(productBody(category.id)).expect(403);
  });

  it('rejects customers and anonymous callers', async () => {
    const customer = await createAccount('CUSTOMER');
    const category = await createCategory();
    await customer.agent.post('/api/products').send(productBody(category.id)).expect(403);
    await request(app).post('/api/products').send(productBody(category.id)).expect(401);
  });

  it.each([
    ['negative price', { price: -1 }],
    ['zero price', { price: 0 }],
    ['three decimals', { price: 1.234 }],
    ['string price', { price: '100' }],
    ['negative stock', { stock: -1 }],
    ['fractional stock', { stock: 1.5 }],
  ])('rejects %s', async (_label, overrides) => {
    const vendor = await createVendor();
    const category = await createCategory();
    await vendor.agent.post('/api/products').send(productBody(category.id, overrides)).expect(422);
  });

  it('rejects inactive categories and duplicate SKUs in one store', async () => {
    const vendor = await createVendor();
    const category = await createCategory();
    const inactive = await Category.create({ name: 'Retired', isActive: false });
    await vendor.agent.post('/api/products').send(productBody(inactive.id)).expect(400);
    await vendor.agent.post('/api/products').send(productBody(category.id)).expect(201);
    await vendor.agent.post('/api/products').send(productBody(category.id)).expect(409);
  });

  it('allows the same SKU in different stores', async () => {
    const [a, b] = [await createVendor(), await createVendor()];
    const category = await createCategory();
    await a.agent.post('/api/products').send(productBody(category.id)).expect(201);
    await b.agent.post('/api/products').send(productBody(category.id)).expect(201);
  });

  it('lets the owner edit and deactivate, keeping the record', async () => {
    const vendor = await createVendor();
    const category = await createCategory();
    const product = await createProduct(vendor.vendorId, category._id);
    const updated = await vendor.agent
      .patch(`/api/products/${product.id}`)
      .send({ name: 'Renamed Item', price: 250 })
      .expect(200);
    expect(updated.body.product.name).toBe('Renamed Item');

    await vendor.agent.delete(`/api/products/${product.id}`).expect(204);
    expect((await Product.findById(product.id))?.isActive).toBe(false);
  });

  it('blocks vendors from touching another vendor\'s product', async () => {
    const [owner, intruder] = [await createVendor(), await createVendor()];
    const category = await createCategory();
    const product = await createProduct(owner.vendorId, category._id, { price: 100, stock: 10 });

    await intruder.agent.patch(`/api/products/${product.id}`).send({ price: 1 }).expect(403);
    await intruder.agent.patch(`/api/products/${product.id}/stock`).send({ adjustment: 5 }).expect(403);
    await intruder.agent.delete(`/api/products/${product.id}`).expect(403);

    const unchanged = await Product.findById(product.id).lean();
    expect(unchanged).toMatchObject({ price: 100, stock: 10, isActive: true });
  });

  it('adjusts stock atomically, never below zero, and ignores stock in PATCH', async () => {
    const vendor = await createVendor();
    const category = await createCategory();
    const product = await createProduct(vendor.vendorId, category._id, { stock: 3 });

    const raised = await vendor.agent.patch(`/api/products/${product.id}/stock`).send({ adjustment: 4 }).expect(200);
    expect(raised.body.product.stock).toBe(7);
    await vendor.agent.patch(`/api/products/${product.id}/stock`).send({ adjustment: -8 }).expect(409);
    await vendor.agent.patch(`/api/products/${product.id}`).send({ stock: 9999 }).expect(200);
    expect((await Product.findById(product.id))?.stock).toBe(7);
  });

  it('shows vendors only their own catalog, including inactive items', async () => {
    const [a, b] = [await createVendor(), await createVendor()];
    const category = await createCategory();
    const mine = await createProduct(a.vendorId, category._id, { isActive: false });
    const theirs = await createProduct(b.vendorId, category._id);

    const res = await a.agent.get('/api/vendors/me/products').expect(200);
    expect(res.body.items.map((p: { _id: string }) => p._id)).toEqual([mine.id]);
    await a.agent.get(`/api/vendors/me/products/${theirs.id}`).expect(404);
  });
});

describe('public catalog', () => {
  async function catalog() {
    const alpha = await createVendor('APPROVED', 'Alpha Store');
    const beta = await createVendor('APPROVED', 'Beta Store');
    const electronics = await createCategory('Electronics');
    const books = await createCategory('Books');
    const phone = await createProduct(alpha.vendorId, electronics._id, { name: 'Pocket Phone', price: 15000 });
    const novel = await createProduct(beta.vendorId, books._id, { name: 'Mystery Novel', price: 300 });
    const soldOut = await createProduct(beta.vendorId, books._id, { name: 'Rare Atlas', price: 900, stock: 0 });
    return { alpha, beta, electronics, books, phone, novel, soldOut };
  }

  const names = (body: { items: { name: string }[] }) => body.items.map((item) => item.name).sort();

  it('hides inactive products, unapproved vendors and inactive categories', async () => {
    const { alpha } = await catalog();
    const suspended = await createVendor('SUSPENDED');
    const retired = await Category.create({ name: 'Retired', isActive: false });
    const category = await createCategory();
    const hiddenA = await createProduct(alpha.vendorId, category._id, { name: 'Inactive Item', isActive: false });
    const hiddenB = await createProduct(suspended.vendorId, category._id, { name: 'Suspended Item' });
    const hiddenC = await createProduct(alpha.vendorId, retired._id, { name: 'Retired Item' });

    const res = await request(app).get('/api/products').expect(200);
    expect(names(res.body)).toEqual(['Mystery Novel', 'Pocket Phone', 'Rare Atlas']);
    for (const hidden of [hiddenA, hiddenB, hiddenC]) {
      await request(app).get(`/api/products/${hidden.id}`).expect(404);
    }
  });

  it('searches case-insensitively and treats regex characters literally', async () => {
    await catalog();
    const res = await request(app).get('/api/products').query({ q: 'mystery' }).expect(200);
    expect(names(res.body)).toEqual(['Mystery Novel']);
    const literal = await request(app).get('/api/products').query({ q: '.*' }).expect(200);
    expect(literal.body.total).toBe(0);
  });

  it('filters by category, vendor, price and availability', async () => {
    const { beta, electronics } = await catalog();
    const byCategory = await request(app).get('/api/products').query({ category: electronics.id });
    expect(names(byCategory.body)).toEqual(['Pocket Phone']);
    const byVendor = await request(app).get('/api/products').query({ vendor: beta.vendorId.toString() });
    expect(names(byVendor.body)).toEqual(['Mystery Novel', 'Rare Atlas']);
    const byPrice = await request(app).get('/api/products').query({ minPrice: 500, maxPrice: 1000 });
    expect(names(byPrice.body)).toEqual(['Rare Atlas']);
    const inStock = await request(app).get('/api/products').query({ inStock: 'true' });
    expect(names(inStock.body)).toEqual(['Mystery Novel', 'Pocket Phone']);
  });

  it('sorts and paginates on the server', async () => {
    await catalog();
    const first = await request(app).get('/api/products').query({ sort: 'price_asc', limit: 2, page: 1 });
    expect(first.body.items.map((p: { price: number }) => p.price)).toEqual([300, 900]);
    expect(first.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    const second = await request(app).get('/api/products').query({ sort: 'price_asc', limit: 2, page: 2 });
    expect(second.body.items.map((p: { price: number }) => p.price)).toEqual([15000]);
  });

  it('rejects invalid query parameters', async () => {
    await request(app).get('/api/products').query({ sort: 'bogus' }).expect(422);
    await request(app).get('/api/products').query({ page: 0 }).expect(422);
    await request(app).get('/api/products').query({ minPrice: 10, maxPrice: 1 }).expect(422);
  });

  it('includes vendor and category display data on details', async () => {
    const { phone } = await catalog();
    const res = await request(app).get(`/api/products/${phone.id}`).expect(200);
    expect(res.body.product.vendor.businessName).toBe('Alpha Store');
    expect(res.body.product.category.name).toBe('Electronics');
  });

  it('lists only approved vendors and serves their storefront', async () => {
    const { alpha } = await catalog();
    const pending = await createVendor('PENDING', 'Pending Store');
    const res = await request(app).get('/api/vendors').expect(200);
    expect(res.body.items.map((v: { businessName: string }) => v.businessName)).toEqual(['Alpha Store', 'Beta Store']);
    expect(res.body.items[0].productCount).toBe(1);
    expect(res.body.items[0].userId).toBeUndefined();

    await request(app).get(`/api/vendors/${alpha.vendorId}`).expect(200);
    await request(app).get(`/api/vendors/${pending.vendorId}`).expect(404);
  });

  it('returns 404 for a well-formed id that does not exist', async () => {
    await request(app).get(`/api/products/${new Types.ObjectId().toString()}`).expect(404);
  });
});
