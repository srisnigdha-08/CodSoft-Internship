import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentUser, requireRole } from '../middleware/auth.js';
import { Order, Payment } from '../models/index.js';
import type { OrderLean } from '../models/Order.js';
import { notFound } from '../utils/AppError.js';
import { objectIdString, parseId } from '../utils/validation.js';
import { toOrderView } from '../services/order.service.js';
import { settleSimulatedPayment, SIMULATED_PAYMENT_LABEL } from '../services/payment.service.js';

// The outcome is chosen by the demo user. Card details are not part of this API.
const simulateSchema = z.object({
  orderId: objectIdString,
  outcome: z.enum(['SUCCESS', 'FAILURE']),
});

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

paymentsRouter.post('/simulate', requireRole('CUSTOMER'), async (req, res) => {
  const { orderId, outcome } = simulateSchema.parse(req.body);
  const order = await Order.findOne({
    _id: parseId(orderId, 'order id'),
    customerId: currentUser(req)._id,
  }).lean<OrderLean>();
  if (!order) throw notFound('Order');

  await settleSimulatedPayment(order, outcome);

  const [updated, payment] = await Promise.all([
    Order.findById(order._id).orFail().lean<OrderLean>(),
    Payment.findOne({ orderId: order._id }).orFail().lean(),
  ]);
  res.json({ label: SIMULATED_PAYMENT_LABEL, payment, order: toOrderView(updated) });
});

paymentsRouter.get('/order/:orderId', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  const user = currentUser(req);
  const payment = await Payment.findOne({
    orderId: parseId(req.params.orderId, 'order id'),
    ...(user.role === 'ADMIN' ? {} : { customerId: user._id }),
  }).lean();
  if (!payment) throw notFound('Payment');
  res.json({ label: SIMULATED_PAYMENT_LABEL, payment });
});
