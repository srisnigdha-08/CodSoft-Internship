import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/db';
import { seedDatabase } from '../src/seed/seed';
import { User, MenuCategory, MenuItem, RestaurantTable, Order, Reservation, Payment, OrderStatusHistory, Role, OrderStatus, PaymentStatus, ReservationStatus, RESERVATION_SLOT_INDEX } from '../src/models';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

// The JWT is only delivered through the HttpOnly cookie, so tests read it from Set-Cookie
function tokenFromResponse(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const cookie = cookies.find((c) => c.startsWith('dinedesk_token='))!;
  return cookie.split(';')[0].split('=')[1];
}

// Dates relative to today so the suite does not expire
function futureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const reservationDate = futureDate(10);
const concurrentDate = futureDate(12);
const guardDate = futureDate(14);
const autoAllocateDate = futureDate(16);
const customerCancelDate = futureDate(18);

describe('DineDesk Full Backend Test Suite', () => {
  let customerToken: string;
  let adminToken: string;
  let kitchenToken: string;
  let testMenuItemId: string;
  let testTableId: string;
  let createdOrderId: string;
  let createdOrderNumber: string;

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeAll(async () => {
    await connectDatabase(process.env.MONGODB_URI!);

    // Obtain tokens by logging in with seed accounts
    const customerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@dinedesk.local', password: 'Customer@12345' });
    customerToken = tokenFromResponse(customerRes);

    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@dinedesk.local', password: 'Admin@12345' });
    adminToken = tokenFromResponse(adminRes);

    const kitchenRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'kitchen@dinedesk.local', password: 'Kitchen@12345' });
    kitchenToken = tokenFromResponse(kitchenRes);

    // Fetch a sample menu item and table
    const menuItem = await MenuItem.findOne().sort({ sortOrder: 1, name: 1 });
    testMenuItemId = menuItem!.id;

    const table = await RestaurantTable.findOne({ tableNumber: 'T-01' });
    testTableId = table!.id;

  });

  // 1. Health check & CORS Security
  describe('Health check & CORS Security', () => {
    it('GET /health - returns healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
    });

    it('GET /api/health - verifies the database without exposing connection details', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
      expect(JSON.stringify(res.body)).not.toMatch(/mongodb:\/\//i);
    });

    it('CORS - allows requests from configured valid frontend origin', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('CORS - rejects requests from unauthorized external origin', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-attacker-site.com');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not allowed by CORS policy/i);
    });
  });

  it('CORS - rejects a localhost origin that is not the configured FRONTEND_ORIGIN', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('CORS - preflight for the configured origin allows credentials', async () => {
    const res = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  // 2. Auth tests
  describe('Authentication & Roles', () => {
    it('POST /api/v1/auth/register - registers a new customer', async () => {
      const email = `testuser_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test Customer',
          email,
          password: 'Password@123',
          phone: '+91 99999 88888',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.role).toBe(Role.CUSTOMER);
      expect(res.body.data.token).toBeUndefined();
      expect(tokenFromResponse(res)).toBeTruthy();
    });

    it('POST /api/v1/auth/login - rejects invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@dinedesk.local', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/auth/me - returns authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('customer@dinedesk.local');
    });

    it('Admin route rejects unauthenticated or customer request', async () => {
      const unauth = await request(app).get('/api/v1/admin/stats');
      expect(unauth.status).toBe(401);

      const customerForbidden = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(customerForbidden.status).toBe(403);
    });
  });

  // 3. Menu & Category tests
  describe('Menu & Categories', () => {
    it('GET /api/v1/categories - returns list of categories', async () => {
      const res = await request(app).get('/api/v1/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body.data.categories.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/menu - returns menu items and supports filtering', async () => {
      const res = await request(app).get('/api/v1/menu?vegetarian=true');
      expect(res.status).toBe(200);
      expect(res.body.data.items.every((i: any) => i.isVegetarian === true)).toBe(true);
    });

    it('GET /api/v1/menu/:id - returns single menu item', async () => {
      const res = await request(app).get(`/api/v1/menu/${testMenuItemId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.item.id).toBe(testMenuItemId);
    });
  });

  // 4. Cart & Order calculations and persistence
  describe('Orders Workflow & Concurrency', () => {
    it('POST /api/v1/orders - calculates totals and creates order', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customerName: 'Priya Sharma',
          customerEmail: 'customer@dinedesk.local',
          customerPhone: '+91 98765 43212',
          orderType: 'DINE_IN',
          tableId: testTableId,
          paymentMethod: 'MOCK_ONLINE',
          items: [{ menuItemId: testMenuItemId, quantity: 2 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const order = res.body.data.order;
      createdOrderId = order.id;
      createdOrderNumber = order.orderNumber;

      // Verify recalculation on server: subtotal = price * 2
      const itemPrice = Number(order.items[0].price);
      expect(Number(order.subtotal)).toBeCloseTo(itemPrice * 2, 2);
      expect(Number(order.tax)).toBeCloseTo(Number(order.subtotal) * 0.05, 2);
      expect(Number(order.totalAmount)).toBeCloseTo(Number(order.subtotal) + Number(order.tax), 2);
      expect(order.payment).toBeDefined();
      expect(order.payment.status).toBe(PaymentStatus.SUCCESSFUL);
    });

    it('POST /api/v1/orders - rejects order with missing delivery address for delivery type', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customerName: 'Priya Sharma',
          customerEmail: 'customer@dinedesk.local',
          customerPhone: '+91 98765 43212',
          orderType: 'DELIVERY',
          items: [{ menuItemId: testMenuItemId, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/delivery address/i);
    });

    it('GET /api/v1/orders/:id - retrieves order and enforces customer ownership', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.order.id).toBe(createdOrderId);
    });

    it('GET /api/v1/orders/:id - rejects unauthenticated access to private account order', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${createdOrderId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/orders/:id - rejects unauthorized customer from viewing another customer private order', async () => {
      // Register a second customer
      const otherUserEmail = `other_customer_${Date.now()}@example.com`;
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Other Customer',
          email: otherUserEmail,
          password: 'Password@123',
        });
      const otherToken = tokenFromResponse(regRes);

      const res = await request(app)
        .get(`/api/v1/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // 5. Kitchen Workflow & Status Transitions
  describe('Kitchen Operations', () => {
    it('GET /api/v1/kitchen/orders - allows kitchen staff to view active orders', async () => {
      const res = await request(app)
        .get('/api/v1/kitchen/orders')
        .set('Authorization', `Bearer ${kitchenToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.orders)).toBe(true);
    });

    it('PATCH /api/v1/kitchen/orders/:id/status - advances order status to PREPARING', async () => {
      const res = await request(app)
        .patch(`/api/v1/kitchen/orders/${createdOrderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: OrderStatus.PREPARING, notes: 'Chef started preparation' });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe(OrderStatus.PREPARING);
    });

    it('PATCH /api/v1/kitchen/orders/:id/status - advances to READY', async () => {
      const res = await request(app)
        .patch(`/api/v1/kitchen/orders/${createdOrderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: OrderStatus.READY, notes: 'Plated and ready for service' });

      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe(OrderStatus.READY);
    });

    it('Rejects invalid status transition (e.g. READY -> PREPARING)', async () => {
      const res = await request(app)
        .patch(`/api/v1/kitchen/orders/${createdOrderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ status: OrderStatus.PREPARING });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid status transition/i);
    });
  });

  // 6. Table Reservations & Double-Booking Prevention
  describe('Table Reservations', () => {
    const testDate = reservationDate;
    const testTime = '20:00';

    it('GET /api/v1/reservations/availability - checks table availability', async () => {
      const res = await request(app)
        .get(`/api/v1/reservations/availability?date=${testDate}&time=${testTime}&guestCount=2`);

      expect(res.status).toBe(200);
      expect(res.body.data.available).toBe(true);
    });

    it('POST /api/v1/reservations - creates and confirms a reservation', async () => {
      const res = await request(app)
        .post('/api/v1/reservations')
        .send({
          customerName: 'Aarav Patel',
          customerEmail: 'aarav@example.com',
          customerPhone: '+91 98111 22334',
          guestCount: 2,
          reservationDate: testDate,
          reservationTime: testTime,
          tableId: testTableId,
          specialRequests: 'Anniversary celebration',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.reservation.tableId).toBe(testTableId);
    });

    it('POST /api/v1/reservations - rejects double-booking on same table and time slot', async () => {
      const res = await request(app)
        .post('/api/v1/reservations')
        .send({
          customerName: 'Different Person',
          customerEmail: 'diff@example.com',
          customerPhone: '+91 98222 33445',
          guestCount: 2,
          reservationDate: testDate,
          reservationTime: testTime,
          tableId: testTableId,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already reserved/i);
    });

    it('POST /api/v1/reservations - concurrency test: simultaneous requests serialize and prevent double booking', async () => {
      const concurrentTime = '19:00';

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/reservations')
          .send({
            customerName: 'Concurrent User 1',
            customerEmail: 'concurrent1@example.com',
            customerPhone: '+91 91111 22222',
            guestCount: 2,
            reservationDate: concurrentDate,
            reservationTime: concurrentTime,
            tableId: testTableId,
          }),
        request(app)
          .post('/api/v1/reservations')
          .send({
            customerName: 'Concurrent User 2',
            customerEmail: 'concurrent2@example.com',
            customerPhone: '+91 93333 44444',
            guestCount: 2,
            reservationDate: concurrentDate,
            reservationTime: concurrentTime,
            tableId: testTableId,
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);
    });
  });

  // 7. Payment Adapter & Failure Simulation
  describe('Payments & Adapter Failure Paths', () => {
    it('POST /api/v1/payments/checkout - simulates payment failure when requested', async () => {
      // Create a pending unpaid order
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .send({
          customerName: 'Cash Customer',
          customerEmail: 'cash@example.com',
          customerPhone: '+91 98333 44556',
          orderType: 'DINE_IN',
          paymentMethod: 'CASH',
          items: [{ menuItemId: testMenuItemId, quantity: 1 }],
        });

      const cashOrderId = orderRes.body.data.order.id;

      const failRes = await request(app)
        .post('/api/v1/payments/checkout')
        .send({
          orderId: cashOrderId,
          method: 'CARD',
          simulateFailure: true,
        });

      expect(failRes.status).toBe(402);
      expect(failRes.body.success).toBe(false);
      expect(failRes.body.data.payment.status).toBe(PaymentStatus.FAILED);
    });
  });

  // 8. Admin Operations
  describe('Admin Operations', () => {
    it('GET /api/v1/admin/stats - returns dashboard metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.stats.totalOrders).toBeGreaterThan(0);
      expect(res.body.data.stats.popularItems).toBeDefined();
    });

    it('GET /api/v1/admin/users - lists users for role management', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.users)).toBe(true);
    });
  });

  // 9. Session security
  describe('Session security', () => {
    const payload = { userId: 'x', email: 'x@example.com', role: Role.ADMIN, name: 'X' };

    it('login sets an HttpOnly SameSite cookie and does not expose the token in JSON', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'customer@dinedesk.local', password: 'Customer@12345' });
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('a browser-style request authenticates with the cookie alone', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Cookie', `dinedesk_token=${customerToken}`);
      expect(res.status).toBe(200);
    });

    it('logout clears the authentication cookie', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toMatch(/^dinedesk_token=;/);
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('rejects expired tokens', async () => {
      const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: -10 });
      const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('rejects tokens signed with a different secret', async () => {
      const token = jwt.sign(payload, 'a-different-secret');
      const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('rejects unsigned (alg: none) tokens', async () => {
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
      const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('stores passwords as bcrypt hashes', async () => {
      const user = await User.findOne({ email: 'customer@dinedesk.local' }).select('+passwordHash');
      expect(user!.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('rejects self-assigned roles at registration', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Sneaky',
        email: `sneaky_${Date.now()}@example.com`,
        password: 'Password@123',
        role: 'ADMIN',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe(Role.CUSTOMER);
    });
  });

  // 10. Role boundaries
  describe('Role boundaries', () => {
    const asCustomer = (req: request.Test) => req.set('Authorization', `Bearer ${customerToken}`);

    it('customer cannot use kitchen endpoints', async () => {
      expect((await asCustomer(request(app).get('/api/v1/kitchen/orders'))).status).toBe(403);
      const patch = await asCustomer(request(app).patch(`/api/v1/kitchen/orders/${createdOrderId}/status`)).send({ status: 'COMPLETED' });
      expect(patch.status).toBe(403);
    });

    it('unauthenticated users cannot use kitchen endpoints', async () => {
      expect((await request(app).get('/api/v1/kitchen/orders')).status).toBe(401);
    });

    it('customer cannot manage menu, tables, users or all reservations', async () => {
      expect((await asCustomer(request(app).post('/api/v1/menu')).send({})).status).toBe(403);
      expect((await asCustomer(request(app).post('/api/v1/categories')).send({})).status).toBe(403);
      expect((await asCustomer(request(app).post('/api/v1/tables')).send({})).status).toBe(403);
      expect((await asCustomer(request(app).get('/api/v1/admin/users'))).status).toBe(403);
      expect((await asCustomer(request(app).get('/api/v1/reservations'))).status).toBe(403);
    });

    it('kitchen staff cannot use admin endpoints', async () => {
      const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${kitchenToken}`);
      expect(res.status).toBe(403);
    });

    it('admin can promote another user but not change their own role', async () => {
      const email = `promote_${Date.now()}@example.com`;
      const reg = await request(app).post('/api/v1/auth/register').send({ name: 'Promote Me', email, password: 'Password@123' });
      const promoted = await request(app)
        .patch(`/api/v1/admin/users/${reg.body.data.user.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'KITCHEN_STAFF' });
      expect(promoted.status).toBe(200);
      expect(promoted.body.data.user.role).toBe('KITCHEN_STAFF');

      const admin = await User.findOne({ email: 'admin@dinedesk.local' });
      const self = await request(app)
        .patch(`/api/v1/admin/users/${admin!.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'CUSTOMER' });
      expect(self.status).toBe(400);
    });

    it('order and reservation history require authentication', async () => {
      expect((await request(app).get('/api/v1/orders/my?email=customer@dinedesk.local')).status).toBe(401);
      expect((await request(app).get('/api/v1/reservations/my?email=customer@dinedesk.local')).status).toBe(401);
    });
  });

  // 11. Business rules and validation
  describe('Order rules and input validation', () => {
    const base = {
      customerName: 'Rule Tester',
      customerEmail: 'rules@example.com',
      customerPhone: '+91 98765 00000',
    };
    const post = (body: object) => request(app).post('/api/v1/orders').send({ ...base, ...body });
    let pickupOrderId: string;

    it('ignores client-supplied totals and prices', async () => {
      const item = await MenuItem.findById(testMenuItemId);
      const res = await post({
        orderType: 'PICKUP',
        paymentMethod: 'MOCK_ONLINE',
        subtotal: 1,
        totalAmount: 1,
        items: [{ menuItemId: testMenuItemId, quantity: 3, price: 0.01 }],
      });
      expect(res.status).toBe(201);
      pickupOrderId = res.body.data.order.id;
      const expectedSubtotal = Number(item!.price) * 3;
      const expectedTax = Number((expectedSubtotal * 0.05).toFixed(2));
      expect(Number(res.body.data.order.subtotal)).toBe(expectedSubtotal);
      expect(Number(res.body.data.order.tax)).toBe(expectedTax);
      expect(Number(res.body.data.order.deliveryFee)).toBe(0);
      expect(Number(res.body.data.order.totalAmount)).toBe(expectedSubtotal + expectedTax);
    });

    it('adds the delivery fee only for delivery orders', async () => {
      const res = await post({
        orderType: 'DELIVERY',
        deliveryAddress: '12 Test Street, Hyderabad',
        items: [{ menuItemId: testMenuItemId, quantity: 1 }],
      });
      expect(res.status).toBe(201);
      expect(Number(res.body.data.order.deliveryFee)).toBe(40);
    });

    it('rejects a whitespace-only delivery address', async () => {
      const res = await post({ orderType: 'DELIVERY', deliveryAddress: '       ', items: [{ menuItemId: testMenuItemId, quantity: 1 }] });
      expect(res.status).toBe(400);
    });

    it('rejects zero, negative, fractional and excessive quantities', async () => {
      for (const quantity of [0, -1, 1.5, 51]) {
        const res = await post({ orderType: 'PICKUP', items: [{ menuItemId: testMenuItemId, quantity }] });
        expect(res.status).toBe(400);
      }
    });

    it('rejects empty carts and unknown menu items', async () => {
      expect((await post({ orderType: 'PICKUP', items: [] })).status).toBe(400);
      const unknown = await post({ orderType: 'PICKUP', items: [{ menuItemId: '000000000000000000000000', quantity: 1 }] });
      expect(unknown.status).toBe(400);
    });

    it('accepts the same dish on two lines and totals both', async () => {
      const item = await MenuItem.findById(testMenuItemId);
      const res = await post({
        orderType: 'PICKUP',
        items: [
          { menuItemId: testMenuItemId, quantity: 1, notes: 'mild' },
          { menuItemId: testMenuItemId, quantity: 2, notes: 'spicy' },
        ],
      });
      expect(res.status).toBe(201);
      expect(Number(res.body.data.order.subtotal)).toBe(Number(item!.price) * 3);
    });

    it('rejects sold-out items', async () => {
      const soldOut = await MenuItem.findOne({ slug: 'artisan-cold-brew-coffee' });
      await MenuItem.updateOne({ _id: soldOut!.id }, { isAvailable: false });
      try {
        const res = await post({ orderType: 'PICKUP', items: [{ menuItemId: soldOut!.id, quantity: 1 }] });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/sold out/i);
      } finally {
        await MenuItem.updateOne({ _id: soldOut!.id }, { isAvailable: true });
      }
    });

    it('does not store a table on non dine-in orders, so bad IDs cannot cause a server error', async () => {
      const res = await post({
        orderType: 'PICKUP',
        tableId: '000000000000000000000000',
        items: [{ menuItemId: testMenuItemId, quantity: 1 }],
      });
      expect(res.status).toBe(201);
      expect(res.body.data.order.tableId).toBeNull();
    });

    it('returns 400 for malformed JSON and JSON 404 for unknown API routes', async () => {
      const malformed = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{not json');
      expect(malformed.status).toBe(400);
      const missing = await request(app).get('/api/v1/does-not-exist');
      expect(missing.status).toBe(404);
      expect(missing.body.success).toBe(false);
    });

    it('returns 400 rather than 500 for invalid query parameters', async () => {
      const staff = { Authorization: `Bearer ${adminToken}` };
      expect((await request(app).get('/api/v1/kitchen/orders?status=NOPE').set(staff)).status).toBe(400);
      expect((await request(app).get('/api/v1/admin/orders?page=abc').set(staff)).status).toBe(400);
      expect((await request(app).get('/api/v1/reservations?status=NOPE').set(staff)).status).toBe(400);
      expect((await request(app).get(`/api/v1/reservations/availability?date=${reservationDate}&time=20:00&guestCount=abc`)).status).toBe(400);
    });

    it('rejects invalid menu input and a non-existent category', async () => {
      const staff = { Authorization: `Bearer ${adminToken}` };
      const invalid = await request(app).post('/api/v1/menu').set(staff).send({ name: 'x', price: -5 });
      expect(invalid.status).toBe(400);
      const badCategory = await request(app).patch(`/api/v1/menu/${testMenuItemId}`).set(staff).send({ categoryId: '000000000000000000000000' });
      expect(badCategory.status).toBe(400);
    });

    it('accepts absolute image URLs and local image paths, but not protocol-relative URLs', async () => {
      const staff = { Authorization: `Bearer ${adminToken}` };
      const dish = await MenuItem.findOne({ slug: 'charred-malai-paneer-tikka' });
      const url = `/api/v1/menu/${dish!.id}`;
      expect(dish!.imageUrl).toBe('/images/charred-malai-paneer-tikka.svg');
      expect((await request(app).patch(url).set(staff).send({ imageUrl: dish!.imageUrl })).status).toBe(200);
      expect((await request(app).patch(url).set(staff).send({ imageUrl: 'https://example.com/dish.png' })).status).toBe(200);
      expect((await request(app).patch(url).set(staff).send({ imageUrl: '//example.com/dish.png' })).status).toBe(400);
      expect((await request(app).patch(url).set(staff).send({ imageUrl: 'not a url' })).status).toBe(400);
      await MenuItem.updateOne({ _id: dish!.id }, { imageUrl: dish!.imageUrl });
    });

    it('every local image path used by a seeded dish exists in the frontend', async () => {
      const dishes = await MenuItem.find({ imageUrl: /^\/images\// });
      expect(dishes.map((d) => d.slug).sort()).toEqual([
        'charred-malai-paneer-tikka',
        'saffron-rose-gulab-jamun',
        'signature-hibiscus-berry-spritz',
        'smoked-chicken-seekh-kebab',
      ]);
      for (const dish of dishes) {
        expect(fs.existsSync(path.resolve(__dirname, '../../client/public', `.${dish.imageUrl}`))).toBe(true);
      }
    });

    it('guest orders are not readable by their short order number', async () => {
      const order = await Order.findById(pickupOrderId);
      const byNumber = await request(app).get(`/api/v1/orders/${order!.orderNumber}`);
      expect(byNumber.status).toBe(404);
      const byUuid = await request(app).get(`/api/v1/orders/${order!.id}`);
      expect(byUuid.status).toBe(200);
    });
  });

  // 12. Full lifecycle and cancellation
  describe('Order lifecycle', () => {
    const staff = () => ({ Authorization: `Bearer ${kitchenToken}` });
    const advance = (id: string, status: string) =>
      request(app).patch(`/api/v1/kitchen/orders/${id}/status`).set(staff()).send({ status });
    const cashOrder = async () =>
      (
        await request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            customerName: 'Priya Sharma',
            customerEmail: 'customer@dinedesk.local',
            customerPhone: '+91 98765 43212',
            orderType: 'DINE_IN',
            paymentMethod: 'CASH',
            items: [{ menuItemId: testMenuItemId, quantity: 1 }],
          })
      ).body.data.order;

    it('walks PENDING → CONFIRMED → PREPARING → READY → COMPLETED and records history', async () => {
      const order = await cashOrder();
      expect(order.status).toBe('PENDING');
      expect(order.payment.status).toBe('PENDING');

      for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']) {
        const res = await advance(order.id, status);
        expect(res.status).toBe(200);
        expect(res.body.data.order.status).toBe(status);
      }

      const final: any = await Order.findById(order.id).populate('payment').populate('statusHistory');
      expect(final!.payment!.status).toBe(PaymentStatus.SUCCESSFUL);
      expect(final!.statusHistory).toHaveLength(5);
    });

    it('rejects skipping PENDING → PREPARING', async () => {
      const order = await cashOrder();
      expect((await advance(order.id, 'PREPARING')).status).toBe(400);
    });

    it('allows only one of two simultaneous status updates', async () => {
      const order = await cashOrder();
      const results = await Promise.all([advance(order.id, 'CONFIRMED'), advance(order.id, 'CONFIRMED')]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const history = await OrderStatusHistory.countDocuments({ orderId: order.id });
      expect(history).toBe(2);
    });

    it('customer can cancel while CONFIRMED and the simulated payment is refunded', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customerName: 'Priya Sharma',
          customerEmail: 'customer@dinedesk.local',
          customerPhone: '+91 98765 43212',
          orderType: 'PICKUP',
          paymentMethod: 'MOCK_ONLINE',
          items: [{ menuItemId: testMenuItemId, quantity: 1 }],
        });
      const cancelled = await request(app)
        .patch(`/api/v1/orders/${res.body.data.order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Changed my mind' });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.order.status).toBe('CANCELLED');
      expect(cancelled.body.data.order.payment.status).toBe(PaymentStatus.REFUNDED);
    });

    it('customer cannot cancel once preparation has started, or cancel another account order', async () => {
      const order = await cashOrder();
      const otherReg = await request(app).post('/api/v1/auth/register').send({
        name: 'Other',
        email: `other_cancel_${Date.now()}@example.com`,
        password: 'Password@123',
      });
      const otherCancel = await request(app)
        .patch(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFromResponse(otherReg)}`)
        .send({});
      expect(otherCancel.status).toBe(403);

      await advance(order.id, 'CONFIRMED');
      await advance(order.id, 'PREPARING');
      const late = await request(app)
        .patch(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});
      expect(late.status).toBe(400);
    });

    it('kitchen cancellation refunds a simulated payment', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customerName: 'Guest',
          customerEmail: 'guest@example.com',
          customerPhone: '+91 98765 11111',
          orderType: 'PICKUP',
          paymentMethod: 'MOCK_ONLINE',
          items: [{ menuItemId: testMenuItemId, quantity: 1 }],
        });
      const cancelled = await advance(res.body.data.order.id, 'CANCELLED');
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.order.payment.status).toBe(PaymentStatus.REFUNDED);
    });
  });

  // 13. Simulated payments
  describe('Simulated payments', () => {
    const orderBody = {
      customerName: 'Pay Tester',
      customerEmail: 'customer@dinedesk.local',
      customerPhone: '+91 98765 22222',
      orderType: 'PICKUP',
      paymentMethod: 'MOCK_ONLINE',
      items: [] as object[],
    };

    it('a simulated decline leaves the order PENDING and a retry confirms it', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .send({ ...orderBody, items: [{ menuItemId: testMenuItemId, quantity: 1 }], simulatePaymentFailure: true });
      expect(created.status).toBe(201);
      expect(created.body.data.order.status).toBe(OrderStatus.PENDING);
      expect(created.body.data.order.payment.status).toBe(PaymentStatus.FAILED);

      const retry = await request(app)
        .post('/api/v1/payments/checkout')
        .send({ orderId: created.body.data.order.id, method: 'MOCK_ONLINE' });
      expect(retry.status).toBe(200);
      expect(retry.body.data.payment.status).toBe(PaymentStatus.SUCCESSFUL);

      const order = await Order.findById(created.body.data.order.id);
      expect(order!.status).toBe(OrderStatus.CONFIRMED);
    });

    it('rejects a second payment and cash through the online endpoint', async () => {
      const created = await request(app)
        .post('/api/v1/orders')
        .send({ ...orderBody, items: [{ menuItemId: testMenuItemId, quantity: 1 }] });
      const again = await request(app)
        .post('/api/v1/payments/checkout')
        .send({ orderId: created.body.data.order.id, method: 'CARD' });
      expect(again.status).toBe(400);
      const cash = await request(app)
        .post('/api/v1/payments/checkout')
        .send({ orderId: created.body.data.order.id, method: 'CASH' });
      expect(cash.status).toBe(400);
    });

    it("a customer cannot pay or inspect another account's order payment", async () => {
      const otherReg = await request(app).post('/api/v1/auth/register').send({
        name: 'Other Payer',
        email: `other_pay_${Date.now()}@example.com`,
        password: 'Password@123',
      });
      const otherToken = tokenFromResponse(otherReg);

      const pay = await request(app)
        .post('/api/v1/payments/checkout')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ orderId: createdOrderId, method: 'CARD' });
      expect(pay.status).toBe(403);

      const read = await request(app)
        .get(`/api/v1/payments/${createdOrderId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(read.status).toBe(403);
    });
  });

  // 14. Reservation guarantees
  describe('Reservation guarantees', () => {
    const body = (extra: object) => ({
      customerName: 'Guard Tester',
      customerEmail: 'guard@example.com',
      customerPhone: '+91 98765 33333',
      guestCount: 2,
      ...extra,
    });

    it('rejects past, impossible and malformed dates', async () => {
      for (const reservationDate of ['2020-01-01', '2030-02-31', '20-1-1']) {
        const res = await request(app).post('/api/v1/reservations').send(body({ reservationDate, reservationTime: '19:00' }));
        expect(res.status).toBe(400);
      }
    });

    it('rejects a table too small for the party', async () => {
      const small = await RestaurantTable.findOne({ tableNumber: 'T-01' });
      const res = await request(app)
        .post('/api/v1/reservations')
        .send(body({ guestCount: 8, reservationDate: guardDate, reservationTime: '13:00', tableId: small!.id }));
      expect(res.status).toBe(400);
    });

    it('the database itself rejects a second active reservation for the same table and slot', async () => {
      const table = await RestaurantTable.findOne({ tableNumber: 'T-02' });
      const row = (n: string, status: ReservationStatus) => ({
        reservationNumber: `RES-GUARD-${n}-${Date.now()}`,
        customerName: 'Guard',
        customerEmail: 'guard@example.com',
        customerPhone: '+91 98765 33333',
        guestCount: 2,
        reservationDate: guardDate,
        reservationTime: '20:00',
        tableId: table!.id,
        status,
      });

      // Bypasses the API on purpose: this proves the constraint, not the application check
      await Reservation.create(row('A', ReservationStatus.CONFIRMED));
      await expect(Reservation.create(row('B', ReservationStatus.PENDING))).rejects.toMatchObject({ code: 11000 });

      // Cancelled history does not occupy the slot
      await Reservation.create(row('C', ReservationStatus.CANCELLED));
    });

    it('a cancelled reservation cannot be revived into a slot that has been rebooked', async () => {
      const table = await RestaurantTable.findOne({ tableNumber: 'T-03' });
      const first = await request(app)
        .post('/api/v1/reservations')
        .send(body({ reservationDate: guardDate, reservationTime: '21:00', tableId: table!.id }));
      const staff = { Authorization: `Bearer ${adminToken}` };
      await request(app).patch(`/api/v1/reservations/${first.body.data.reservation.id}/status`).set(staff).send({ status: 'CANCELLED' });
      const second = await request(app)
        .post('/api/v1/reservations')
        .send(body({ reservationDate: guardDate, reservationTime: '21:00', tableId: table!.id }));
      expect(second.status).toBe(201);

      const revive = await request(app)
        .patch(`/api/v1/reservations/${first.body.data.reservation.id}/status`)
        .set(staff)
        .send({ status: 'CONFIRMED' });
      expect(revive.status).toBe(400);
    });

    it('concurrent auto-allocated bookings never share a table', async () => {
      // Only T-05 seats 8, so exactly one of these can succeed
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app).post('/api/v1/reservations').send(body({ guestCount: 8, reservationDate: autoAllocateDate, reservationTime: '19:00' }))
        )
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
    });

    it('customers can cancel their own reservation but not someone else\'s', async () => {
      const created = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(body({ reservationDate: customerCancelDate, reservationTime: '19:00' }));
      expect(created.status).toBe(201);
      const id = created.body.data.reservation.id;

      const otherReg = await request(app).post('/api/v1/auth/register').send({
        name: 'Other Booker',
        email: `other_booker_${Date.now()}@example.com`,
        password: 'Password@123',
      });
      const denied = await request(app)
        .patch(`/api/v1/reservations/${id}/cancel`)
        .set('Authorization', `Bearer ${tokenFromResponse(otherReg)}`);
      expect(denied.status).toBe(403);

      const own = await request(app)
        .patch(`/api/v1/reservations/${id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(own.status).toBe(200);
      expect(own.body.data.reservation.status).toBe('CANCELLED');

      const history = await request(app).get('/api/v1/reservations/my').set('Authorization', `Bearer ${customerToken}`);
      expect(history.body.data.reservations.some((r: any) => r.id === id)).toBe(true);
    });
  });

  // 15. Catalog filtering against MongoDB
  describe('Menu filtering', () => {
    const menu = async (query: string) => (await request(app).get('/api/v1/menu' + query)).body.data.items as any[];

    it('filters vegetarian=true and vegetarian=false on the stored field', async () => {
      const [veg, nonVeg, all] = await Promise.all([menu('?vegetarian=true'), menu('?vegetarian=false'), menu('')]);
      expect(veg.length).toBeGreaterThan(0);
      expect(nonVeg.length).toBeGreaterThan(0);
      expect(veg.every((i) => i.isVegetarian)).toBe(true);
      expect(nonVeg.every((i) => !i.isVegetarian)).toBe(true);
      expect(veg.length + nonVeg.length).toBe(all.length);
    });

    it('combines category and vegetarian filters', async () => {
      const items = await menu('?category=starters&vegetarian=true');
      expect(items.length).toBe(2);
      expect(items.every((i) => i.category.slug === 'starters' && i.isVegetarian)).toBe(true);
    });

    it('returns nothing for an unknown category', async () => {
      expect(await menu('?category=does-not-exist')).toEqual([]);
    });

    it('treats search text literally rather than as a regular expression', async () => {
      expect((await menu('?search=paneer')).length).toBe(1);
      expect(await menu('?search=' + encodeURIComponent('.*'))).toEqual([]);
      expect((await request(app).get('/api/v1/menu?search=' + encodeURIComponent('('))).status).toBe(200);
    });

    it('exposes category item counts and a string id', async () => {
      const res = await request(app).get('/api/v1/categories');
      const starters = res.body.data.categories.find((c: any) => c.slug === 'starters');
      expect(starters._count.items).toBe(4);
      expect(starters.id).toMatch(/^[a-f\d]{24}$/);
      expect(starters._id).toBeUndefined();
    });

    it('serves item details by id and by slug', async () => {
      const byId = await request(app).get('/api/v1/menu/' + testMenuItemId);
      const bySlug = await request(app).get('/api/v1/menu/' + byId.body.data.item.slug);
      expect(bySlug.body.data.item.id).toBe(testMenuItemId);
      expect(bySlug.body.data.item.category.name).toBeTruthy();
    });

    it('returns 404 for malformed and unknown item ids', async () => {
      expect((await request(app).get('/api/v1/menu/not-a-real-id')).status).toBe(404);
      expect((await request(app).get('/api/v1/menu/000000000000000000000000')).status).toBe(404);
    });
  });

  // 16. Identity and data scoping
  describe('Identity and scoping', () => {
    it('rejects query-operator objects in login', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
      expect(res.status).toBe(400);
    });

    it('rejects sessions issued before the MongoDB migration', async () => {
      const token = jwt.sign({ userId: '4f1c2c9e-7a54-4a2e-9a7e-2f7b3f3f0a11', email: 'a@b.co', role: Role.ADMIN, name: 'Old' }, process.env.JWT_SECRET!);
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer ' + token)).status).toBe(401);
    });

    it('rejects duplicate registration with a conflict', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ name: 'Dup', email: 'customer@dinedesk.local', password: 'Password@123' });
      expect(res.status).toBe(409);
    });

    it('profile returns only the signed-in user and no password data', async () => {
      const res = await request(app).get('/api/v1/auth/me?userId=000000000000000000000000').set('Authorization', 'Bearer ' + customerToken);
      expect(res.body.data.user.email).toBe('customer@dinedesk.local');
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    });

    it('never returns password data in the admin user list', async () => {
      const res = await request(app).get('/api/v1/admin/users').set('Authorization', 'Bearer ' + adminToken);
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
      expect(res.body.data.users[0]._count).toBeDefined();
    });

    it('order history ignores email and userId parameters', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send({ name: 'Scoped User', email: 'scoped_' + Date.now() + '@example.com', password: 'Password@123' });
      const victim = await User.findOne({ email: 'customer@dinedesk.local' });
      const orders = await request(app)
        .get('/api/v1/orders/my?email=customer@dinedesk.local&userId=' + victim!.id)
        .set('Authorization', 'Bearer ' + tokenFromResponse(reg));
      expect(orders.status).toBe(200);
      expect(orders.body.data.orders).toEqual([]);

      const own = await request(app).get('/api/v1/orders/my').set('Authorization', 'Bearer ' + customerToken);
      expect(own.body.data.orders.length).toBeGreaterThan(0);
      expect(own.body.data.orders.every((o: any) => o.customerId === victim!.id)).toBe(true);
      expect(own.body.data.orders[0].payment).toBeDefined();
    });
  });

  // 17. Admin management
  describe('Admin management', () => {
    const staff = () => ({ Authorization: 'Bearer ' + adminToken });
    const dishBody = (categoryId: string, slug: string) => ({
      categoryId,
      name: 'Audit Dish',
      slug,
      description: 'A dish created by the test suite.',
      price: 123.5,
      imageUrl: '/images/charred-malai-paneer-tikka.svg',
    });

    it('creates, updates and deletes categories, cascading to their dishes', async () => {
      const created = await request(app).post('/api/v1/categories').set(staff()).send({ name: 'Test Specials', slug: 'test-specials' });
      expect(created.status).toBe(201);
      const categoryId = created.body.data.category.id;

      const duplicate = await request(app).post('/api/v1/categories').set(staff()).send({ name: 'Test Specials', slug: 'test-specials-2' });
      expect(duplicate.status).toBe(409);

      const renamed = await request(app).patch('/api/v1/categories/' + categoryId).set(staff()).send({ description: 'Updated' });
      expect(renamed.body.data.category.description).toBe('Updated');

      const dish = await request(app).post('/api/v1/menu').set(staff()).send(dishBody(categoryId, 'cascade-dish'));
      expect(dish.status).toBe(201);

      expect((await request(app).delete('/api/v1/categories/' + categoryId).set(staff())).status).toBe(200);
      expect(await MenuItem.exists({ slug: 'cascade-dish' })).toBeNull();
    });

    it('deleting a dish keeps past orders and clears their link', async () => {
      const category = await MenuCategory.findOne({ slug: 'mains' });
      const dish = await request(app).post('/api/v1/menu').set(staff()).send(dishBody(category!.id, 'short-lived-dish'));
      const dishId = dish.body.data.item.id;
      expect(dish.body.data.item.category.slug).toBe('mains');

      const placed = await request(app).post('/api/v1/orders').send({
        customerName: 'Keeper',
        customerEmail: 'keeper@example.com',
        customerPhone: '+91 98765 77777',
        orderType: 'PICKUP',
        paymentMethod: 'CASH',
        items: [{ menuItemId: dishId, quantity: 2 }],
      });
      expect(placed.status).toBe(201);
      expect(Number(placed.body.data.order.subtotal)).toBe(247);

      expect((await request(app).delete('/api/v1/menu/' + dishId).set(staff())).status).toBe(200);
      const stored = await Order.findById(placed.body.data.order.id);
      expect(stored!.items[0].menuItemId).toBeNull();
      expect(stored!.items[0].name).toBe('Audit Dish');
    });

    it('manages tables and refuses to delete one with an upcoming booking', async () => {
      const created = await request(app).post('/api/v1/tables').set(staff()).send({ tableNumber: 'T-TEST', capacity: 4 });
      expect(created.status).toBe(201);
      const tableId = created.body.data.table.id;

      const off = await request(app).patch('/api/v1/tables/' + tableId).set(staff()).send({ isActive: false });
      expect(off.body.data.table.isActive).toBe(false);
      await request(app).patch('/api/v1/tables/' + tableId).set(staff()).send({ isActive: true });

      const booking = await request(app).post('/api/v1/reservations').send({
        customerName: 'Table Tester',
        customerEmail: 'table@example.com',
        customerPhone: '+91 98765 88888',
        guestCount: 2,
        reservationDate: futureDate(20),
        reservationTime: '18:00',
        tableId,
      });
      expect(booking.status).toBe(201);
      expect((await request(app).delete('/api/v1/tables/' + tableId).set(staff())).status).toBe(400);

      await request(app).patch('/api/v1/reservations/' + booking.body.data.reservation.id + '/status').set(staff()).send({ status: 'CANCELLED' });
      expect((await request(app).delete('/api/v1/tables/' + tableId).set(staff())).status).toBe(200);
      expect(await RestaurantTable.exists({ tableNumber: 'T-TEST' })).toBeNull();
    });

    it('confirms and completes reservations, and lists all of them', async () => {
      const booking = await request(app).post('/api/v1/reservations').send({
        customerName: 'Flow Tester',
        customerEmail: 'flow@example.com',
        customerPhone: '+91 98765 99999',
        guestCount: 2,
        reservationDate: futureDate(22),
        reservationTime: '18:30',
      });
      const id = booking.body.data.reservation.id;
      expect(booking.body.data.reservation.table.tableNumber).toBeTruthy();
      expect((await request(app).patch('/api/v1/reservations/' + id + '/status').set(staff()).send({ status: 'COMPLETED' })).body.data.reservation.status).toBe('COMPLETED');
      expect((await request(app).patch('/api/v1/reservations/' + id + '/status').set(staff()).send({ status: 'CONFIRMED' })).status).toBe(400);

      const list = await request(app).get('/api/v1/reservations?status=COMPLETED').set(staff());
      expect(list.body.data.reservations.some((r: any) => r.id === id)).toBe(true);
    });

    it('searches and paginates the orders ledger and reports stats', async () => {
      const search = await request(app).get('/api/v1/admin/orders?search=' + encodeURIComponent('priya') + '&limit=2').set(staff());
      expect(search.status).toBe(200);
      expect(search.body.data.orders.length).toBeLessThanOrEqual(2);
      expect(search.body.data.pagination.total).toBeGreaterThan(0);

      const stats = await request(app).get('/api/v1/admin/stats').set(staff());
      expect(stats.body.data.stats.totalRevenue).toBeGreaterThan(0);
      expect(stats.body.data.stats.popularItems.length).toBeGreaterThan(0);
    });
  });

  // 18. MongoDB behaviour
  describe('MongoDB behaviour', () => {
    const orderBody = (email: string, extra: object = {}) => ({
      customerName: 'Mongo Tester',
      customerEmail: email,
      customerPhone: '+91 98765 66666',
      orderType: 'PICKUP',
      paymentMethod: 'MOCK_ONLINE',
      items: [{ menuItemId: testMenuItemId, quantity: 1 }],
      ...extra,
    });

    it('stores references as ObjectIds and embeds line items', async () => {
      const res = await request(app).post('/api/v1/orders').set('Authorization', 'Bearer ' + customerToken).send(orderBody('refs@example.com', { orderType: 'DINE_IN', tableId: testTableId }));
      const raw = await Order.collection.findOne({ _id: new Types.ObjectId(res.body.data.order.id) });
      expect(raw!.customerId).toBeInstanceOf(Types.ObjectId);
      expect(raw!.tableId).toBeInstanceOf(Types.ObjectId);
      expect(raw!.items[0].menuItemId).toBeInstanceOf(Types.ObjectId);
      expect(res.body.data.order.items[0].orderId).toBe(res.body.data.order.id);
      expect(res.body.data.order.table.id).toBe(testTableId);
    });

    it('links exactly one payment and a status history to each order', async () => {
      const res = await request(app).post('/api/v1/orders').send(orderBody('links@example.com'));
      const orderId = res.body.data.order.id;
      expect(await Payment.countDocuments({ orderId })).toBe(1);
      const history = await OrderStatusHistory.find({ orderId }).sort({ createdAt: 1, _id: 1 });
      expect(history.map((h) => h.newStatus)).toEqual(['PENDING', 'CONFIRMED']);
      expect(res.body.data.order.statusHistory).toHaveLength(2);
      expect(res.body.data.order.payment.orderId).toBe(orderId);

      const duplicate = Payment.create({ paymentNumber: 'PAY-DUP-' + Date.now(), orderId, amount: 1, method: 'CARD' });
      await expect(duplicate).rejects.toMatchObject({ code: 11000 });
    });

    it('enforces unique email, slug and table number', async () => {
      await expect(User.create({ email: 'CUSTOMER@dinedesk.local', passwordHash: 'x', name: 'Dup' })).rejects.toMatchObject({ code: 11000 });
      const category = await MenuCategory.findOne();
      await expect(MenuItem.create({ categoryId: category!._id, name: 'Dup', slug: 'butter-chicken-royale', description: 'Duplicate', price: 1, imageUrl: '/x.svg' })).rejects.toMatchObject({ code: 11000 });
      await expect(RestaurantTable.create({ tableNumber: 'T-01', capacity: 2 })).rejects.toMatchObject({ code: 11000 });
    });

    it('validates documents at the schema level', async () => {
      const order = new Order({ orderNumber: 'BAD', customerName: 'x', customerEmail: 'x@y.co', customerPhone: '1', subtotal: -1, tax: 0, totalAmount: 0, items: [] });
      const error = order.validateSync();
      expect(error?.errors.subtotal).toBeDefined();
      expect(error?.errors.items).toBeDefined();
    });

    it('creates the expected indexes, including the partial double-booking guard', async () => {
      const indexes = await Reservation.collection.indexes();
      const guard = indexes.find((i) => i.name === RESERVATION_SLOT_INDEX)!;
      expect(guard.unique).toBe(true);
      expect(guard.partialFilterExpression).toEqual({ holdsSlot: true });

      const orderIndexes = (await Order.collection.indexes()).map((i) => Object.keys(i.key).join(','));
      expect(orderIndexes).toEqual(expect.arrayContaining(['customerId,createdAt', 'status,createdAt', 'orderType', 'createdAt']));
      const itemIndexes = (await MenuItem.collection.indexes()).map((i) => Object.keys(i.key).join(','));
      expect(itemIndexes).toEqual(expect.arrayContaining(['isVegetarian', 'isAvailable', 'name']));
      expect(mongoose.connection.db!.databaseName).toMatch(/test/);
    });

    it('rolls back an order when its payment cannot be saved', async () => {
      const spy = vi.spyOn(Payment, 'create').mockRejectedValueOnce(new Error('Simulated write failure'));
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const res = await request(app).post('/api/v1/orders').send(orderBody('rollback@example.com'));
        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toMatch(/Simulated write failure/);
      } finally {
        spy.mockRestore();
        quiet.mockRestore();
      }
      expect(await Order.countDocuments({ customerEmail: 'rollback@example.com' })).toBe(0);
    });

    it('rolls back a status change when its history cannot be saved', async () => {
      const placed = await request(app).post('/api/v1/orders').send(orderBody('statusrollback@example.com'));
      const orderId = placed.body.data.order.id;
      const spy = vi.spyOn(OrderStatusHistory, 'create').mockRejectedValueOnce(new Error('Simulated write failure'));
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const res = await request(app).patch('/api/v1/kitchen/orders/' + orderId + '/status').set('Authorization', 'Bearer ' + kitchenToken).send({ status: 'PREPARING' });
        expect(res.status).toBe(500);
      } finally {
        spy.mockRestore();
        quiet.mockRestore();
      }
      expect((await Order.findById(orderId))!.status).toBe('CONFIRMED');
    });

    it('seeding again changes nothing', async () => {
      const counts = () => Promise.all([User, MenuCategory, MenuItem, RestaurantTable, Order, Payment, Reservation, OrderStatusHistory].map((m: any) => m.countDocuments()));
      const before = await counts();
      await seedDatabase();
      expect(await counts()).toEqual(before);
    });

    it('seeded dishes keep their local image paths', async () => {
      const dish = await MenuItem.findOne({ slug: 'saffron-rose-gulab-jamun' });
      expect(dish!.imageUrl).toBe('/images/saffron-rose-gulab-jamun.svg');
    });
  });
});
