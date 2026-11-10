import type { Types } from 'mongoose';
import { Order } from '../models/index.js';
import type { VendorOrderStatus } from '../models/constants.js';
import type { OrderLean, VendorOrderLean } from '../models/Order.js';
import { conflict, notFound } from '../utils/AppError.js';
import { runUnitOfWork } from '../utils/unitOfWork.js';
import { restockVendorOrder } from './order.service.js';
import { refundVendorShare } from './payment.service.js';

export const ALLOWED_TRANSITIONS: Record<VendorOrderStatus, VendorOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Advances one vendor's shipment. The query matches only that vendor's
 * sub-document at its expected status, so other vendors' fulfillment cannot be
 * touched and two simultaneous updates cannot both win.
 */
export async function updateFulfillment(
  orderId: Types.ObjectId,
  vendorId: Types.ObjectId,
  next: VendorOrderStatus,
  note?: string,
): Promise<OrderLean> {
  const order = await Order.findOne({
    _id: orderId,
    'vendorOrders.vendorId': vendorId,
  }).lean<OrderLean>();
  if (!order) throw notFound('Order');

  const vendorOrder = order.vendorOrders.find((vo) => vo.vendorId.equals(vendorId)) as VendorOrderLean;
  if (order.paymentStatus !== 'PAID') {
    throw conflict('Only paid orders can be fulfilled');
  }
  if (!ALLOWED_TRANSITIONS[vendorOrder.status].includes(next)) {
    throw conflict(`Cannot change status from ${vendorOrder.status} to ${next}`, {
      allowed: ALLOWED_TRANSITIONS[vendorOrder.status],
    });
  }

  await runUnitOfWork(async (uow) => {
    const previous = vendorOrder.status;
    const updated = await Order.updateOne(
      {
        _id: orderId,
        paymentStatus: 'PAID',
        vendorOrders: { $elemMatch: { vendorId, status: previous } },
      },
      {
        $set: { 'vendorOrders.$.status': next },
        $push: {
          'vendorOrders.$.statusHistory': { status: next, actor: 'VENDOR', at: new Date(), note },
        },
      },
      { session: uow.session },
    );
    if (updated.modifiedCount === 0) {
      throw conflict('This shipment was just updated. Refresh and try again.');
    }
    uow.onRollback(() =>
      Order.updateOne(
        { _id: orderId, vendorOrders: { $elemMatch: { vendorId, status: next } } },
        {
          $set: { 'vendorOrders.$.status': previous },
          $pop: { 'vendorOrders.$.statusHistory': 1 },
        },
      ),
    );

    if (next === 'CANCELLED') {
      await restockVendorOrder(vendorOrder, uow);
      await refundVendorShare(orderId, vendorOrder.total, uow);
    }
  });

  return Order.findById(orderId).orFail().lean<OrderLean>();
}
