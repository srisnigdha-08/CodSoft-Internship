import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';
import { Role, OrderStatus, PaymentStatus } from '@prisma/client';

describe('DineDesk Full Backend Test Suite', () => {
  let customerToken: string;
  let adminToken: string;
  let kitchenToken: string;
  let testMenuItemId: string;
  let testTableId: string;
  let createdOrderId: string;
  let createdOrderNumber: string;

  beforeAll(async () => {
    // Obtain tokens by logging in with seed accounts
    const customerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@dinedesk.local', password: 'Customer@12345' });
    customerToken = customerRes.body.data.token;

    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@dinedesk.local', password: 'Admin@12345' });
    adminToken = adminRes.body.data.token;

    const kitchenRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'kitchen@dinedesk.local', password: 'Kitchen@12345' });
    kitchenToken = kitchenRes.body.data.token;

    // Fetch a sample menu item and table
    const menuItem = await prisma.menuItem.findFirst();
    testMenuItemId = menuItem!.id;

    const table = await prisma.restaurantTable.findFirst();
    testTableId = table!.id;
  });

  // 1. Health check
  it('GET /health - returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
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
      expect(res.body.data.token).toBeDefined();
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
    const testDate = '2026-11-20';
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
});
