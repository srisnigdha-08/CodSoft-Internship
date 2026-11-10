import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Order, OrderStatus, Payment, PaymentMethod, PaymentStatus } from '../models';
import { transitionOrder } from '../services/orderTransitions';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { idOrField } from '../utils/ids';

const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  notes: z.string().max(500).optional(),
});

const kitchenQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
});

export async function getKitchenOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = kitchenQuerySchema.parse(req.query);

    const where = status
      ? { status }
      : // By default, kitchen sees active orders that require preparation
        { status: { $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] } };

    const orders = await Order.find(where)
      .sort({ createdAt: 1, _id: 1 }) // FIFO: oldest orders first
      .populate({ path: 'items.menuItem', select: 'name imageUrl preparationTimeMinutes isVegetarian' })
      .populate('table')
      .populate({ path: 'payment', select: 'orderId method status' })
      .populate({ path: 'statusHistory', options: { sort: { createdAt: -1, _id: -1 } }, perDocumentLimit: 1 });

    return sendSuccess(res, { orders });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = updateStatusSchema.parse(req.body);

    const order = await Order.findOne(idOrField(id, 'orderNumber'));

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const currentStatus = order.status;
    const targetStatus = validated.status;

    // Check valid transitions
    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid status transition: Cannot move order from "${currentStatus}" to "${targetStatus}". Permitted transitions: ${allowed.join(', ') || 'None'}.`
      );
    }

    const payment = await Payment.findOne({ orderId: order._id });

    let paymentStatus: PaymentStatus | undefined;
    if (payment) {
      if (targetStatus === OrderStatus.CANCELLED && payment.status === PaymentStatus.SUCCESSFUL) {
        paymentStatus = PaymentStatus.REFUNDED;
      }
      // Completing a cash order means the cash was collected at handover
      if (targetStatus === OrderStatus.COMPLETED && payment.method === PaymentMethod.CASH && payment.status === PaymentStatus.PENDING) {
        paymentStatus = PaymentStatus.SUCCESSFUL;
      }
    }

    await transitionOrder({
      orderId: order._id,
      from: currentStatus,
      to: targetStatus,
      changedByUserId: req.user?.userId || null,
      notes: validated.notes || `Order advanced to ${targetStatus} by kitchen staff`,
      // Two staff clicks or a racing customer cancel cannot both succeed
      conflictMessage: 'This order was just updated by someone else. Refresh and try again.',
      payment:
        payment && paymentStatus
          ? {
              id: payment._id,
              previousStatus: payment.status,
              previousGatewayResponse: payment.gatewayResponse,
              status: paymentStatus,
            }
          : undefined,
    });

    const updatedOrder = await Order.findById(order._id)
      .populate('table')
      .populate('payment')
      .populate({ path: 'statusHistory', options: { sort: { createdAt: -1, _id: -1 } } });

    return sendSuccess(res, { order: updatedOrder }, `Order status updated to ${targetStatus}`);
  } catch (err) {
    next(err);
  }
}
