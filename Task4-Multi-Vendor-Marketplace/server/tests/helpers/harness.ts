import bcrypt from 'bcrypt';
import mongoose, { type Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { TEST_DATABASE_NAME } from '../../src/config/env.js';
import { Category, Product, User, Vendor, allModels } from '../../src/models/index.js';
import type { Role, VendorApprovalStatus } from '../../src/models/constants.js';

export const app = createApp();
export const PASSWORD = 'Passw0rdTest';

/** Connects to the test database and clears only that database between tests. */
export function useTestDatabase(): void {
  beforeAll(async () => {
    await connectDatabase();
    if (mongoose.connection.name !== TEST_DATABASE_NAME) {
      throw new Error(`Connected to unexpected database ${mongoose.connection.name}`);
    }
    await Promise.all(allModels.map((model) => model.init()));
  });

  beforeEach(async () => {
    if (mongoose.connection.name !== TEST_DATABASE_NAME) throw new Error('Not the test database');
    await Promise.all(allModels.map((model) => model.collection.deleteMany({})));
  });

  afterAll(async () => {
    await Promise.all(allModels.map((model) => model.collection.deleteMany({})));
    await disconnectDatabase();
  });
}

let sequence = 0;
const unique = () => `${Date.now().toString(36)}${(sequence += 1)}`;

export interface TestAccount {
  agent: ReturnType<typeof request.agent>;
  userId: Types.ObjectId;
  email: string;
}

export async function createAccount(role: Role, name = `${role} user`): Promise<TestAccount> {
  const email = `${role.toLowerCase()}-${unique()}@test.example`;
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const user = await User.create({ name, email, passwordHash, role });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { agent, userId: user._id, email };
}

export interface TestVendor extends TestAccount {
  vendorId: Types.ObjectId;
}

export async function createVendor(
  approvalStatus: VendorApprovalStatus = 'APPROVED',
  businessName = `Store ${unique()}`,
): Promise<TestVendor> {
  const account = await createAccount('VENDOR', `${businessName} owner`);
  const vendor = await Vendor.create({
    userId: account.userId,
    businessName,
    contactEmail: account.email,
    address: { line1: '1 Test Street', city: 'Testville', state: 'Testland', postalCode: '100001' },
    approvalStatus,
  });
  return { ...account, vendorId: vendor._id };
}

export async function createCategory(name = `Category ${unique()}`) {
  return Category.create({ name });
}

export async function createProduct(
  vendorId: Types.ObjectId,
  categoryId: Types.ObjectId,
  overrides: Partial<{ name: string; price: number; stock: number; isActive: boolean; sku: string }> = {},
) {
  return Product.create({
    vendorId,
    categoryId,
    name: `Product ${unique()}`,
    description: 'A product used for automated testing.',
    price: 100,
    stock: 10,
    sku: `SKU-${unique()}`.toUpperCase(),
    ...overrides,
  });
}

export const shipping = {
  fullName: 'Test Customer',
  phone: '+91 90000 11111',
  address: { line1: '5 Delivery Road', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001' },
};

/** A customer with products from two different vendors already in their cart. */
export async function multiVendorScenario() {
  const category = await createCategory();
  const vendorA = await createVendor('APPROVED', 'Vendor Alpha');
  const vendorB = await createVendor('APPROVED', 'Vendor Beta');
  const productA = await createProduct(vendorA.vendorId, category._id, { price: 500, stock: 10 });
  const productB = await createProduct(vendorB.vendorId, category._id, { price: 1200, stock: 5 });
  const customer = await createAccount('CUSTOMER');
  await customer.agent.post('/api/cart/items').send({ productId: productA.id, quantity: 2 }).expect(201);
  await customer.agent.post('/api/cart/items').send({ productId: productB.id, quantity: 1 }).expect(201);
  return { category, vendorA, vendorB, productA, productB, customer };
}

export async function placePaidOrder(scenario: Awaited<ReturnType<typeof multiVendorScenario>>) {
  const placed = await scenario.customer.agent.post('/api/orders').send(shipping).expect(201);
  const orderId: string = placed.body.order._id;
  await scenario.customer.agent
    .post('/api/payments/simulate')
    .send({ orderId, outcome: 'SUCCESS' })
    .expect(200);
  return orderId;
}

/** Walks a vendor shipment along the allowed path up to DELIVERED. */
export async function deliverShipment(vendor: TestVendor, orderId: string) {
  for (const status of ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']) {
    await vendor.agent.patch(`/api/vendors/me/orders/${orderId}/status`).send({ status }).expect(200);
  }
}
