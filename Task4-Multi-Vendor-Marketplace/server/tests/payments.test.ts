import { describe, expect, it, vi } from 'vitest';
import { Cart, Order, Payment, Product } from '../src/models/index.js';
import {
  createAccount,
  multiVendorScenario,
  placePaidOrder,
  shipping,
  useTestDatabase,
} from './helpers/harness.js';

useTestDatabase();

async function pendingOrder() {
  const scenario = await multiVendorScenario();
  const { body } = await scenario.customer.agent.post('/api/orders').send(shipping).expect(201);
  return { ...scenario, orderId: body.order._id as string };
}

describe('simulated payment', () => {
  it('marks payment and order PAID and labels the result as simulated', async () => {
    const { customer, orderId } = await pendingOrder();
    const { body } = await customer.agent
      .post('/api/payments/simulate')
      .send({ orderId, outcome: 'SUCCESS' })
      .expect(200);
    expect(body.label).toBe('SIMULATED PAYMENT');
    expect(body.payment).toMatchObject({ status: 'PAID', method: 'SIMULATED' });
    expect(body.payment.reference).toMatch(/^SIM-/);
    expect(body.order).toMatchObject({ paymentStatus: 'PAID', status: 'IN_PROGRESS' });
  });

  it('on failure releases stock, cancels shipments and returns items to the cart', async () => {
    const { customer, orderId, productA, productB } = await pendingOrder();
    const { body } = await customer.agent
      .post('/api/payments/simulate')
      .send({ orderId, outcome: 'FAILURE' })
      .expect(200);

    expect(body.payment.status).toBe('FAILED');
    expect(body.order).toMatchObject({ paymentStatus: 'FAILED', status: 'PAYMENT_FAILED' });
    expect(body.order.vendorOrders.every((vo: { status: string }) => vo.status === 'CANCELLED')).toBe(true);
    expect((await Product.findById(productA._id))?.stock).toBe(10);
    expect((await Product.findById(productB._id))?.stock).toBe(5);
    expect((await Cart.findOne({ customerId: customer.userId }))?.items).toHaveLength(2);
  });

  it('can only settle once', async () => {
    const { customer, orderId, productA } = await pendingOrder();
    await customer.agent.post('/api/payments/simulate').send({ orderId, outcome: 'SUCCESS' }).expect(200);
    await customer.agent.post('/api/payments/simulate').send({ orderId, outcome: 'FAILURE' }).expect(409);
    expect((await Payment.findOne({ orderId }))?.status).toBe('PAID');
    expect((await Product.findById(productA._id))?.stock).toBe(8);
  });

  it('settles exactly once under concurrent attempts and never double-restocks', async () => {
    const { customer, orderId, productA } = await pendingOrder();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        customer.agent.post('/api/payments/simulate').send({ orderId, outcome: 'FAILURE' }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await Product.findById(productA._id))?.stock).toBe(10);
  });

  it('prevents paying for someone else\'s order', async () => {
    const { orderId } = await pendingOrder();
    const stranger = await createAccount('CUSTOMER');
    await stranger.agent.post('/api/payments/simulate').send({ orderId, outcome: 'SUCCESS' }).expect(404);
    expect((await Payment.findOne({ orderId }))?.status).toBe('PENDING');
  });

  it('accepts no card fields and stores none', async () => {
    const { customer, orderId } = await pendingOrder();
    await customer.agent
      .post('/api/payments/simulate')
      .send({ orderId, outcome: 'SUCCESS', cardNumber: '4111111111111111', cvv: '123' })
      .expect(200);
    const stored = JSON.stringify(await Payment.findOne({ orderId }).lean());
    expect(stored).not.toContain('4111');
    expect(stored).not.toMatch(/cvv/i);
  });

  it('rejects unknown outcomes', async () => {
    const { customer, orderId } = await pendingOrder();
    await customer.agent.post('/api/payments/simulate').send({ orderId, outcome: 'MAYBE' }).expect(422);
  });

  it('reverts the payment when settlement fails midway', async () => {
    const { customer, orderId } = await pendingOrder();
    const spy = vi.spyOn(Order, 'updateOne').mockImplementationOnce(() => {
      throw new Error('simulated database failure');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await customer.agent.post('/api/payments/simulate').send({ orderId, outcome: 'SUCCESS' }).expect(500);

    spy.mockRestore();
    consoleSpy.mockRestore();
    expect((await Payment.findOne({ orderId }))?.status).toBe('PENDING');
    expect((await Order.findById(orderId))?.paymentStatus).toBe('PENDING');
    await customer.agent.post('/api/payments/simulate').send({ orderId, outcome: 'SUCCESS' }).expect(200);
  });

  it('lets a customer cancel an unpaid order', async () => {
    const { customer, orderId, productA } = await pendingOrder();
    const cancelled = await customer.agent.post(`/api/orders/${orderId}/cancel`).expect(200);
    expect(cancelled.body.order.status).toBe('PAYMENT_FAILED');
    expect((await Product.findById(productA._id))?.stock).toBe(10);
    expect((await Payment.findOne({ orderId }))?.failureReason).toBe('Cancelled by customer');
  });

  it('refuses to cancel a paid order through the customer endpoint', async () => {
    const scenario = await multiVendorScenario();
    const paidId = await placePaidOrder(scenario);
    await scenario.customer.agent.post(`/api/orders/${paidId}/cancel`).expect(409);
  });
});
