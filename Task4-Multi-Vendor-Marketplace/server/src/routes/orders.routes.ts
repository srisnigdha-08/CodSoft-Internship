import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate, currentUser, requireRole } from '../middleware/auth.js';
import { Order, Payment } from '../models/index.js';
import type { OrderLean } from '../models/Order.js';
import { conflict, notFound } from '../utils/AppError.js';
import {
  addressSchema,
  paginated,
  paginationQuery,
  parseId,
  phoneSchema,
} from '../utils/validation.js';
import { placeOrder, toOrderView } from '../services/order.service.js';
import { cancelUnpaidOrder } from '../services/payment.service.js';

// Monetary fields are not part of this schema, so client-sent totals are discarded.
const placeOrderSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  address: addressSchema,
});

/** Returns 404 rather than 403 so order ids cannot be probed for existence. */
async function loadAccessibleOrder(req: Request): Promise<OrderLean> {
  const user = currentUser(req);
  const order = await Order.findOne({
    _id: parseId(req.params.id),
    ...(user.role === 'ADMIN' ? {} : { customerId: user._id }),
  }).lean<OrderLean>();
  if (!order) throw notFound('Order');
  return order;
}

export const ordersRouter = Router();

ordersRouter.use(authenticate);

ordersRouter.post('/', requireRole('CUSTOMER'), async (req, res) => {
  const input = placeOrderSchema.parse(req.body);
  const order = await placeOrder(currentUser(req), input);
  res.status(201).json({ order: toOrderView(order) });
});

ordersRouter.get('/', requireRole('CUSTOMER'), async (req, res) => {
  const { page, limit } = paginationQuery.parse(req.query);
  const filter = { customerId: currentUser(req)._id };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<OrderLean[]>(),
    Order.countDocuments(filter),
  ]);
  res.json(paginated(orders.map(toOrderView), total, page, limit));
});

ordersRouter.get('/:id', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  const order = await loadAccessibleOrder(req);
  const payment = await Payment.findOne({ orderId: order._id }).lean();
  res.json({ order: toOrderView(order), payment });
});

ordersRouter.post('/:id/cancel', requireRole('CUSTOMER'), async (req, res) => {
  const order = await loadAccessibleOrder(req);
  if (order.paymentStatus !== 'PENDING') {
    throw conflict('Only orders awaiting payment can be cancelled here');
  }
  await cancelUnpaidOrder(order);
  const updated = await Order.findById(order._id).orFail().lean<OrderLean>();
  res.json({ order: toOrderView(updated) });
});
