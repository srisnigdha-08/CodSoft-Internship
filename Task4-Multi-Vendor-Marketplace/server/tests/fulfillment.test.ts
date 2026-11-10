import { describe, expect, it } from 'vitest';
import { Order, Payment, Product } from '../src/models/index.js';
import {
  createVendor,
  deliverShipment,
  multiVendorScenario,
  placePaidOrder,
  shipping,
  useTestDatabase,
} from './helpers/harness.js';

useTestDatabase();

const statusUrl = (orderId: string) => `/api/vendors/me/orders/${orderId}/status`;

describe('vendor-specific fulfillment', () => {
  it('shows each vendor only its own shipment', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);

    const { body } = await scenario.vendorA.agent.get('/api/vendors/me/orders').expect(200);
    expect(body.total).toBe(1);
    const view = body.items[0];
    expect(view.fulfillment.vendorName).toBe('Vendor Alpha');
    expect(view.vendorOrders).toBeUndefined();
    expect(view.grandTotal).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('Vendor Beta');

    const detail = await scenario.vendorB.agent.get(`/api/vendors/me/orders/${orderId}`).expect(200);
    expect(detail.body.order.fulfillment.vendorName).toBe('Vendor Beta');
  });

  it('updates one vendor without affecting the other', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);

    await scenario.vendorA.agent.patch(statusUrl(orderId)).send({ status: 'CONFIRMED' }).expect(200);

    const stored = await Order.findById(orderId).lean();
    const byVendor = (id: unknown) => stored?.vendorOrders.find((vo) => String(vo.vendorId) === String(id));
    expect(byVendor(scenario.vendorA.vendorId)?.status).toBe('CONFIRMED');
    expect(byVendor(scenario.vendorB.vendorId)?.status).toBe('PENDING');
    expect(byVendor(scenario.vendorA.vendorId)?.statusHistory.at(-1)?.actor).toBe('VENDOR');
  });

  it('shows the customer independent statuses for each vendor', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await deliverShipment(scenario.vendorA, orderId);
    await scenario.vendorB.agent.patch(statusUrl(orderId)).send({ status: 'CONFIRMED' }).expect(200);

    const { body } = await scenario.customer.agent.get(`/api/orders/${orderId}`).expect(200);
    expect(body.order.vendorOrders.map((vo: { status: string }) => vo.status)).toEqual(['DELIVERED', 'CONFIRMED']);
    expect(body.order.status).toBe('IN_PROGRESS');

    await deliverShipmentFrom(scenario.vendorB, orderId, ['PROCESSING', 'SHIPPED', 'DELIVERED']);
    const done = await scenario.customer.agent.get(`/api/orders/${orderId}`).expect(200);
    expect(done.body.order.status).toBe('COMPLETED');
  });

  async function deliverShipmentFrom(vendor: { agent: Awaited<ReturnType<typeof createVendor>>['agent'] }, orderId: string, steps: string[]) {
    for (const status of steps) {
      await vendor.agent.patch(statusUrl(orderId)).send({ status }).expect(200);
    }
  }

  it('denies vendors with no items in the order', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    const outsider = await createVendor();
    await outsider.agent.patch(statusUrl(orderId)).send({ status: 'CONFIRMED' }).expect(404);
    await outsider.agent.get(`/api/vendors/me/orders/${orderId}`).expect(404);
    expect((await outsider.agent.get('/api/vendors/me/orders')).body.total).toBe(0);
  });

  it('blocks customers from vendor endpoints', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await scenario.customer.agent.patch(statusUrl(orderId)).send({ status: 'CONFIRMED' }).expect(403);
  });

  it.each([
    ['skipping steps', ['SHIPPED']],
    ['delivering early', ['DELIVERED']],
    ['returning to pending', ['PENDING']],
  ])('rejects %s', async (_label, [status]) => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await scenario.vendorA.agent.patch(statusUrl(orderId)).send({ status }).expect(409);
  });

  it('rejects moves out of terminal states and cancelling after shipping', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await deliverShipment(scenario.vendorA, orderId);
    await scenario.vendorA.agent.patch(statusUrl(orderId)).send({ status: 'CANCELLED' }).expect(409);

    for (const status of ['CONFIRMED', 'PROCESSING', 'SHIPPED']) {
      await scenario.vendorB.agent.patch(statusUrl(orderId)).send({ status }).expect(200);
    }
    await scenario.vendorB.agent.patch(statusUrl(orderId)).send({ status: 'CANCELLED' }).expect(409);
  });

  it('rejects unknown statuses', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await scenario.vendorA.agent.patch(statusUrl(orderId)).send({ status: 'TELEPORTED' }).expect(422);
  });

  it('does not expose or allow fulfillment of unpaid orders', async () => {
    const scenario = await multiVendorScenario();
    const { body } = await scenario.customer.agent.post('/api/orders').send(shipping).expect(201);
    expect((await scenario.vendorA.agent.get('/api/vendors/me/orders')).body.total).toBe(0);
    await scenario.vendorA.agent.patch(statusUrl(body.order._id)).send({ status: 'CONFIRMED' }).expect(409);
  });

  it('accepts only one of two simultaneous transitions', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    const results = await Promise.all([
      scenario.vendorA.agent.patch(statusUrl(orderId)).send({ status: 'CONFIRMED' }),
      scenario.vendorA.agent.patch(statusUrl(orderId)).send({ status: 'CANCELLED' }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const stored = await Order.findById(orderId).lean();
    expect(stored?.vendorOrders[0].statusHistory).toHaveLength(2);
  });

  it('a vendor cancellation restocks and refunds only that vendor\'s share', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await scenario.vendorA.agent.patch(statusUrl(orderId)).send({ status: 'CANCELLED' }).expect(200);

    expect((await Product.findById(scenario.productA._id))?.stock).toBe(10);
    expect((await Product.findById(scenario.productB._id))?.stock).toBe(4);
    const payment = await Payment.findOne({ orderId }).lean();
    expect(payment).toMatchObject({ status: 'PAID', refundedAmount: 1180 });
    expect((await Order.findById(orderId))?.paymentStatus).toBe('PAID');
  });

  it('marks the payment REFUNDED once every vendor has cancelled', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await scenario.vendorA.agent.patch(statusUrl(orderId)).send({ status: 'CANCELLED' }).expect(200);
    await scenario.vendorB.agent.patch(statusUrl(orderId)).send({ status: 'CANCELLED' }).expect(200);

    expect((await Payment.findOne({ orderId }))?.status).toBe('REFUNDED');
    const { body } = await scenario.customer.agent.get(`/api/orders/${orderId}`).expect(200);
    expect(body.order).toMatchObject({ paymentStatus: 'REFUNDED', status: 'CANCELLED' });
  });

  it('reports vendor statistics from that vendor\'s data only', async () => {
    const scenario = await multiVendorScenario();
    const orderId = await placePaidOrder(scenario);
    await deliverShipment(scenario.vendorA, orderId);

    const a = await scenario.vendorA.agent.get('/api/vendors/me/dashboard').expect(200);
    expect(a.body).toMatchObject({ totalProducts: 1, totalOrders: 1, completedOrders: 1, pendingOrders: 0, revenue: 1000 });
    const b = await scenario.vendorB.agent.get('/api/vendors/me/dashboard').expect(200);
    expect(b.body).toMatchObject({ totalProducts: 1, totalOrders: 1, completedOrders: 0, pendingOrders: 1, revenue: 1200 });

    const sales = await scenario.vendorA.agent.get('/api/vendors/me/sales').expect(200);
    expect(sales.body.totalRevenue).toBe(1000);
    expect(sales.body.topProducts[0]).toMatchObject({ quantity: 2, revenue: 1000 });
  });

  it('protects vendor approval status from self-service edits', async () => {
    const pending = await createVendor('PENDING');
    const res = await pending.agent
      .patch('/api/vendors/me')
      .send({ description: 'Updated', approvalStatus: 'APPROVED' })
      .expect(200);
    expect(res.body.vendor.approvalStatus).toBe('PENDING');
    expect(res.body.vendor.description).toBe('Updated');
  });
});
