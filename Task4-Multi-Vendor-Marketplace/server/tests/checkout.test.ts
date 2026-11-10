import { describe, expect, it, vi } from 'vitest';
import { Cart, Order, Payment, Product, Vendor } from '../src/models/index.js';
import { lineTotal, priceVendorLines, sumVendorTotals } from '../src/utils/money.js';
import {
  createAccount,
  createCategory,
  createProduct,
  createVendor,
  multiVendorScenario,
  shipping,
  useTestDatabase,
} from './helpers/harness.js';

useTestDatabase();

describe('money calculations', () => {
  it('avoids floating point drift', () => {
    expect(lineTotal({ unitPrice: 19.99, quantity: 3 })).toBe(59.97);
    expect(lineTotal({ unitPrice: 0.1, quantity: 3 })).toBe(0.3);
  });

  it('rounds tax to the nearest paisa', () => {
    expect(priceVendorLines([{ unitPrice: 33.33, quantity: 1 }]).tax).toBe(6);
    expect(priceVendorLines([{ unitPrice: 10.05, quantity: 1 }]).tax).toBe(1.81);
  });

  it('charges delivery per vendor below the free-delivery threshold only', () => {
    expect(priceVendorLines([{ unitPrice: 998.99, quantity: 1 }]).deliveryFee).toBe(49);
    expect(priceVendorLines([{ unitPrice: 999, quantity: 1 }]).deliveryFee).toBe(0);
    expect(priceVendorLines([]).deliveryFee).toBe(0);
  });

  it('sums vendor totals exactly', () => {
    const a = priceVendorLines([{ unitPrice: 19.99, quantity: 3 }]);
    const b = priceVendorLines([{ unitPrice: 0.1, quantity: 3 }]);
    expect(sumVendorTotals([a, b]).grandTotal).toBe(Number((a.total + b.total).toFixed(2)));
  });
});

describe('checkout', () => {
  it('creates one order with an independent shipment per vendor', async () => {
    const { customer, vendorA, vendorB } = await multiVendorScenario();
    const { body } = await customer.agent.post('/api/orders').send(shipping).expect(201);

    expect(await Order.countDocuments()).toBe(1);
    expect(body.order.orderNumber).toMatch(/^MKT-\d+$/);
    expect(body.order.vendorOrders.map((vo: { vendorId: string }) => vo.vendorId)).toEqual([
      vendorA.vendorId.toString(),
      vendorB.vendorId.toString(),
    ]);
    expect(body.order.vendorOrders.every((vo: { status: string }) => vo.status === 'PENDING')).toBe(true);
    expect(body.order.status).toBe('AWAITING_PAYMENT');
    expect(body.order.paymentStatus).toBe('PENDING');
  });

  it('calculates totals on the server and ignores client-sent money', async () => {
    const { customer } = await multiVendorScenario();
    const { body } = await customer.agent
      .post('/api/orders')
      .send({ ...shipping, subtotal: 1, tax: 0, deliveryFee: 0, total: 1, grandTotal: 1, unitPrice: 1 })
      .expect(201);
    expect(body.order).toMatchObject({ subtotal: 2200, tax: 396, deliveryFee: 0, grandTotal: 2596 });
    expect(body.order.vendorOrders[0]).toMatchObject({ subtotal: 1000, tax: 180, deliveryFee: 0, total: 1180 });

    const payment = await Payment.findOne({ orderId: body.order._id }).lean();
    expect(payment).toMatchObject({ amount: 2596, status: 'PENDING', method: 'SIMULATED' });
  });

  it('applies delivery fees per vendor', async () => {
    const category = await createCategory();
    const [a, b] = [await createVendor(), await createVendor()];
    const pa = await createProduct(a.vendorId, category._id, { price: 100 });
    const pb = await createProduct(b.vendorId, category._id, { price: 200 });
    const customer = await createAccount('CUSTOMER');
    await customer.agent.post('/api/cart/items').send({ productId: pa.id }).expect(201);
    await customer.agent.post('/api/cart/items').send({ productId: pb.id }).expect(201);

    const { body } = await customer.agent.post('/api/orders').send(shipping).expect(201);
    expect(body.order).toMatchObject({ subtotal: 300, tax: 54, deliveryFee: 98, grandTotal: 452 });
  });

  it('uses the current catalog price, snapshotting it on the order', async () => {
    const { customer, productA } = await multiVendorScenario();
    await Product.updateOne({ _id: productA._id }, { price: 650 });
    const { body } = await customer.agent.post('/api/orders').send(shipping).expect(201);
    expect(body.order.vendorOrders[0].items[0]).toMatchObject({ unitPrice: 650, lineTotal: 1300 });

    await Product.updateOne({ _id: productA._id }, { price: 1 });
    const stored = await Order.findById(body.order._id).lean();
    expect(stored?.vendorOrders[0].items[0].unitPrice).toBe(650);
  });

  it('reserves inventory and empties the cart', async () => {
    const { customer, productA, productB } = await multiVendorScenario();
    await customer.agent.post('/api/orders').send(shipping).expect(201);
    expect((await Product.findById(productA._id))?.stock).toBe(8);
    expect((await Product.findById(productB._id))?.stock).toBe(4);
    expect((await Cart.findOne({ customerId: customer.userId }))?.items).toHaveLength(0);
  });

  it('rejects an empty cart, non-customers and invalid addresses', async () => {
    const customer = await createAccount('CUSTOMER');
    await customer.agent.post('/api/orders').send(shipping).expect(400);
    const vendor = await createVendor();
    await vendor.agent.post('/api/orders').send(shipping).expect(403);
    const scenario = await multiVendorScenario();
    await scenario.customer.agent.post('/api/orders').send({ ...shipping, address: { city: 'x' } }).expect(422);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('refuses checkout beyond stock without changing anything', async () => {
    const { customer, productA, productB } = await multiVendorScenario();
    await Product.updateOne({ _id: productB._id }, { stock: 0 });
    const res = await customer.agent.post('/api/orders').send(shipping).expect(409);
    expect(res.body.error.details[0].issue).toBe('INSUFFICIENT_STOCK');
    expect((await Product.findById(productA._id))?.stock).toBe(10);
    expect(await Order.countDocuments()).toBe(0);
    expect((await Cart.findOne({ customerId: customer.userId }))?.items).toHaveLength(2);
  });

  it('refuses checkout when a vendor was suspended after items were added', async () => {
    const { customer, vendorB } = await multiVendorScenario();
    await Vendor.updateOne({ _id: vendorB.vendorId }, { approvalStatus: 'SUSPENDED' });
    await customer.agent.post('/api/orders').send(shipping).expect(409);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('does not oversell when customers race for the last unit', async () => {
    const category = await createCategory();
    const vendor = await createVendor();
    const product = await createProduct(vendor.vendorId, category._id, { stock: 1 });
    const buyers = await Promise.all(Array.from({ length: 5 }, () => createAccount('CUSTOMER')));
    for (const buyer of buyers) {
      await buyer.agent.post('/api/cart/items').send({ productId: product.id }).expect(201);
    }

    const results = await Promise.all(buyers.map((b) => b.agent.post('/api/orders').send(shipping)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect((await Product.findById(product._id))?.stock).toBe(0);
    expect(await Order.countDocuments()).toBe(1);
  });

  it('restores inventory and the cart when a later step fails', async () => {
    const { customer, productA, productB } = await multiVendorScenario();
    const spy = vi.spyOn(Payment, 'create').mockRejectedValueOnce(new Error('simulated database failure'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await customer.agent.post('/api/orders').send(shipping).expect(500);
    expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });

    spy.mockRestore();
    consoleSpy.mockRestore();
    expect((await Product.findById(productA._id))?.stock).toBe(10);
    expect((await Product.findById(productB._id))?.stock).toBe(5);
    expect(await Order.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
    expect((await Cart.findOne({ customerId: customer.userId }))?.items).toHaveLength(2);
  });
});

describe('customer order access', () => {
  it('lists only the customer\'s own orders and hides others', async () => {
    const { customer } = await multiVendorScenario();
    const { body } = await customer.agent.post('/api/orders').send(shipping).expect(201);
    const history = await customer.agent.get('/api/orders').expect(200);
    expect(history.body.total).toBe(1);

    const detail = await customer.agent.get(`/api/orders/${body.order._id}`).expect(200);
    expect(detail.body.payment.method).toBe('SIMULATED');

    const stranger = await createAccount('CUSTOMER');
    expect((await stranger.agent.get('/api/orders')).body.total).toBe(0);
    await stranger.agent.get(`/api/orders/${body.order._id}`).expect(404);
    await stranger.agent.get(`/api/payments/order/${body.order._id}`).expect(404);
  });

  it('blocks vendors from the customer order endpoint', async () => {
    const { customer, vendorA } = await multiVendorScenario();
    const { body } = await customer.agent.post('/api/orders').send(shipping).expect(201);
    await vendorA.agent.get(`/api/orders/${body.order._id}`).expect(403);
  });
});
