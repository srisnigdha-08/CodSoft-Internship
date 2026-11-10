import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Product, Review } from '../src/models/index.js';
import {
  app,
  createAccount,
  deliverShipment,
  multiVendorScenario,
  placePaidOrder,
  useTestDatabase,
} from './helpers/harness.js';

useTestDatabase();

const reviewBody = (productId: string, rating = 5) => ({ productId, rating, comment: 'Exactly as described.' });

async function deliveredScenario() {
  const scenario = await multiVendorScenario();
  const orderId = await placePaidOrder(scenario);
  await deliverShipment(scenario.vendorA, orderId);
  return { ...scenario, orderId };
}

describe('reviews', () => {
  it('lets a customer review a delivered purchase and updates the rating', async () => {
    const { customer, productA } = await deliveredScenario();
    const eligibility = await customer.agent.get(`/api/products/${productA.id}/review-eligibility`).expect(200);
    expect(eligibility.body).toEqual({ canReview: true, hasReviewed: false });

    await customer.agent.post('/api/reviews').send(reviewBody(productA.id, 4)).expect(201);
    expect(await Product.findById(productA._id).lean()).toMatchObject({ rating: 4, reviewCount: 1 });

    const listed = await request(app).get(`/api/products/${productA.id}/reviews`).expect(200);
    expect(listed.body.items[0].authorName).toBe('CUSTOMER user');
    expect(JSON.stringify(listed.body)).not.toContain('@test.example');
  });

  it('prevents a duplicate review, including under concurrency', async () => {
    const { customer, productA } = await deliveredScenario();
    const results = await Promise.all([
      customer.agent.post('/api/reviews').send(reviewBody(productA.id)),
      customer.agent.post('/api/reviews').send(reviewBody(productA.id)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    await customer.agent.post('/api/reviews').send(reviewBody(productA.id)).expect(409);
    expect(await Review.countDocuments()).toBe(1);
  });

  it('rejects customers who never bought the product', async () => {
    const { productA } = await deliveredScenario();
    const stranger = await createAccount('CUSTOMER');
    await stranger.agent.post('/api/reviews').send(reviewBody(productA.id)).expect(403);
    const eligibility = await stranger.agent.get(`/api/products/${productA.id}/review-eligibility`).expect(200);
    expect(eligibility.body.canReview).toBe(false);
  });

  it('rejects purchases not yet delivered and unpaid orders', async () => {
    const { customer, productB } = await deliveredScenario();
    await customer.agent.post('/api/reviews').send(reviewBody(productB.id)).expect(403);
  });

  it('rejects vendors, admins and anonymous callers', async () => {
    const { vendorA, productA } = await deliveredScenario();
    await vendorA.agent.post('/api/reviews').send(reviewBody(productA.id)).expect(403);
    const admin = await createAccount('ADMIN');
    await admin.agent.post('/api/reviews').send(reviewBody(productA.id)).expect(403);
    await request(app).post('/api/reviews').send(reviewBody(productA.id)).expect(401);
  });

  it('validates rating range', async () => {
    const { customer, productA } = await deliveredScenario();
    for (const rating of [0, 6, 3.5]) {
      await customer.agent.post('/api/reviews').send(reviewBody(productA.id, rating)).expect(422);
    }
  });

  it('allows deleting only your own review, and admin moderation', async () => {
    const { customer, productA } = await deliveredScenario();
    const created = await customer.agent.post('/api/reviews').send(reviewBody(productA.id)).expect(201);
    const reviewId: string = created.body.review._id;

    const stranger = await createAccount('CUSTOMER');
    await stranger.agent.delete(`/api/reviews/${reviewId}`).expect(403);

    const admin = await createAccount('ADMIN');
    await admin.agent.delete(`/api/reviews/${reviewId}`).expect(204);
    expect(await Product.findById(productA._id).lean()).toMatchObject({ rating: 0, reviewCount: 0 });
  });

  it('lists only the signed-in customer\'s reviews', async () => {
    const { customer, productA } = await deliveredScenario();
    await customer.agent.post('/api/reviews').send(reviewBody(productA.id)).expect(201);
    expect((await customer.agent.get('/api/reviews/mine').expect(200)).body.items).toHaveLength(1);
    const stranger = await createAccount('CUSTOMER');
    expect((await stranger.agent.get('/api/reviews/mine').expect(200)).body.items).toHaveLength(0);
  });
});
