import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Cart, Product, Vendor } from '../src/models/index.js';
import {
  app,
  createAccount,
  createCategory,
  createProduct,
  createVendor,
  multiVendorScenario,
  useTestDatabase,
} from './helpers/harness.js';

useTestDatabase();

describe('cart', () => {
  it('requires a customer session', async () => {
    await request(app).get('/api/cart').expect(401);
    const vendor = await createVendor();
    await vendor.agent.get('/api/cart').expect(403);
  });

  it('holds products from multiple vendors, grouped per vendor', async () => {
    const { customer, vendorA, vendorB } = await multiVendorScenario();
    const { body } = await customer.agent.get('/api/cart').expect(200);

    expect(body.cart.vendors).toHaveLength(2);
    const names = body.cart.vendors.map((g: { vendor: { businessName: string } }) => g.vendor.businessName);
    expect(names).toEqual(['Vendor Alpha', 'Vendor Beta']);

    const stored = await Cart.findOne({ customerId: customer.userId }).lean();
    expect(stored?.items.map((item) => item.vendorId.toString())).toEqual([
      vendorA.vendorId.toString(),
      vendorB.vendorId.toString(),
    ]);
    expect(body.cart.itemCount).toBe(3);
    expect(body.cart.canCheckout).toBe(true);
  });

  it('computes totals from server prices per vendor', async () => {
    const { customer } = await multiVendorScenario();
    const { body } = await customer.agent.get('/api/cart').expect(200);
    // Alpha: 2 x 500 = 1000, free delivery. Beta: 1200, free delivery. Tax 18%.
    expect(body.cart.vendors[0].totals).toEqual({ subtotal: 1000, tax: 180, deliveryFee: 0, total: 1180 });
    expect(body.cart.totals).toEqual({ subtotal: 2200, tax: 396, deliveryFee: 0, grandTotal: 2596 });
  });

  it('takes vendorId and price from the catalog, not the request', async () => {
    const vendor = await createVendor();
    const other = await createVendor();
    const category = await createCategory();
    const product = await createProduct(vendor.vendorId, category._id, { price: 100 });
    const customer = await createAccount('CUSTOMER');

    const res = await customer.agent
      .post('/api/cart/items')
      .send({ productId: product.id, quantity: 1, price: 1, vendorId: other.vendorId.toString() })
      .expect(201);
    expect(res.body.cart.vendors[0].vendor._id).toBe(vendor.vendorId.toString());
    expect(res.body.cart.vendors[0].items[0].unitPrice).toBe(100);
  });

  it('merges repeated adds and survives concurrent adds of one product', async () => {
    const vendor = await createVendor();
    const category = await createCategory();
    const product = await createProduct(vendor.vendorId, category._id, { stock: 50 });
    const customer = await createAccount('CUSTOMER');

    await Promise.all(
      Array.from({ length: 5 }, () =>
        customer.agent.post('/api/cart/items').send({ productId: product.id, quantity: 1 }).expect(201),
      ),
    );
    const cart = await Cart.findOne({ customerId: customer.userId }).lean();
    expect(cart?.items).toHaveLength(1);
    expect(cart?.items[0].quantity).toBe(5);
  });

  it('changes quantity, removes items and rejects invalid quantities', async () => {
    const { customer, productA } = await multiVendorScenario();
    const updated = await customer.agent
      .patch(`/api/cart/items/${productA.id}`)
      .send({ quantity: 4 })
      .expect(200);
    expect(updated.body.cart.vendors[0].items[0].quantity).toBe(4);

    for (const quantity of [0, -1, 1.5, 100, '2']) {
      await customer.agent.patch(`/api/cart/items/${productA.id}`).send({ quantity }).expect(422);
    }

    const removed = await customer.agent.delete(`/api/cart/items/${productA.id}`).expect(200);
    expect(removed.body.cart.vendors).toHaveLength(1);
    await customer.agent.delete(`/api/cart/items/${productA.id}`).expect(404);
  });

  it('refuses quantities above stock, including across repeated adds', async () => {
    const vendor = await createVendor();
    const category = await createCategory();
    const product = await createProduct(vendor.vendorId, category._id, { stock: 3 });
    const customer = await createAccount('CUSTOMER');

    await customer.agent.post('/api/cart/items').send({ productId: product.id, quantity: 4 }).expect(409);
    await customer.agent.post('/api/cart/items').send({ productId: product.id, quantity: 2 }).expect(201);
    await customer.agent.post('/api/cart/items').send({ productId: product.id, quantity: 2 }).expect(409);
    await customer.agent.patch(`/api/cart/items/${product.id}`).send({ quantity: 4 }).expect(409);
  });

  it('refuses inactive products and products of suspended vendors', async () => {
    const vendor = await createVendor('SUSPENDED');
    const active = await createVendor();
    const category = await createCategory();
    const suspendedItem = await createProduct(vendor.vendorId, category._id);
    const inactiveItem = await createProduct(active.vendorId, category._id, { isActive: false });
    const customer = await createAccount('CUSTOMER');
    await customer.agent.post('/api/cart/items').send({ productId: suspendedItem.id }).expect(404);
    await customer.agent.post('/api/cart/items').send({ productId: inactiveItem.id }).expect(404);
  });

  it('flags lines that became unavailable or under-stocked and blocks checkout', async () => {
    const { customer, productA, productB, vendorB } = await multiVendorScenario();
    await Product.updateOne({ _id: productA._id }, { stock: 1 });
    await Vendor.updateOne({ _id: vendorB.vendorId }, { approvalStatus: 'SUSPENDED' });
    const { body } = await customer.agent.get('/api/cart').expect(200);

    const issues = body.cart.vendors.flatMap((g: { items: { productId: string; issue: string }[] }) => g.items);
    expect(issues.find((i: { productId: string }) => i.productId === productA.id).issue).toBe('INSUFFICIENT_STOCK');
    expect(issues.find((i: { productId: string }) => i.productId === productB.id).issue).toBe('UNAVAILABLE');
    expect(body.cart.canCheckout).toBe(false);
  });

  it('keeps each customer\'s cart private', async () => {
    const { customer } = await multiVendorScenario();
    const stranger = await createAccount('CUSTOMER');
    const { body } = await stranger.agent.get('/api/cart').expect(200);
    expect(body.cart.vendors).toHaveLength(0);
    expect((await customer.agent.get('/api/cart')).body.cart.vendors).toHaveLength(2);
  });
});
