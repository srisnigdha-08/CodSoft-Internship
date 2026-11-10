import { randomUUID } from 'node:crypto';
import type { Types } from 'mongoose';
import { Order, Payment } from '../models/index.js';
import type { OrderLean } from '../models/Order.js';
import type { StatusActor } from '../models/constants.js';
import { conflict } from '../utils/AppError.js';
import { toMinor } from '../utils/money.js';
import { runUnitOfWork, type UnitOfWork } from '../utils/unitOfWork.js';
import { returnItemsToCart } from './cart.service.js';
import { restockVendorOrder } from './order.service.js';

export const SIMULATED_PAYMENT_LABEL = 'SIMULATED PAYMENT';

export type SettlementOutcome = 'SUCCESS' | 'FAILURE';

/** Only one caller can move a payment out of PENDING, so each order settles once. */
async function claimPendingPayment(
  orderId: Types.ObjectId,
  outcome: SettlementOutcome,
  failureReason: string | undefined,
  uow: UnitOfWork,
) {
  const payment = await Payment.findOneAndUpdate(
    { orderId, status: 'PENDING' },
    {
      $set: {
        status: outcome === 'SUCCESS' ? 'PAID' : 'FAILED',
        reference: `SIM-${randomUUID().slice(0, 8).toUpperCase()}`,
        processedAt: new Date(),
        ...(failureReason ? { failureReason } : {}),
      },
    },
    { returnDocument: 'after', session: uow.session },
  );
  if (!payment) throw conflict('This payment has already been processed');
  uow.onRollback(() =>
    Payment.updateOne(
      { orderId },
      { $set: { status: 'PENDING' }, $unset: { reference: 1, processedAt: 1, failureReason: 1 } },
    ),
  );
  return payment;
}

/** Releases everything an unpaid order holds: stock back to catalog, items back to cart. */
async function releaseUnpaidOrder(order: OrderLean, actor: StatusActor, uow: UnitOfWork) {
  for (const vendorOrder of order.vendorOrders) await restockVendorOrder(vendorOrder, uow);

  const at = new Date();
  await Order.updateOne(
    { _id: order._id, paymentStatus: 'PENDING' },
    {
      $set: { paymentStatus: 'FAILED', 'vendorOrders.$[].status': 'CANCELLED' },
      $push: { 'vendorOrders.$[].statusHistory': { status: 'CANCELLED', actor, at } },
    },
    { session: uow.session },
  );
  uow.onRollback(() =>
    Order.updateOne(
      { _id: order._id },
      {
        $set: { paymentStatus: 'PENDING', 'vendorOrders.$[].status': 'PENDING' },
        $pop: { 'vendorOrders.$[].statusHistory': 1 },
      },
    ),
  );

  // Last step, so the undo steps above never have to reason about cart contents.
  await returnItemsToCart(
    order.customerId,
    order.vendorOrders.flatMap((vendorOrder) =>
      vendorOrder.items.map((item) => ({
        productId: item.productId,
        vendorId: vendorOrder.vendorId,
        quantity: item.quantity,
      })),
    ),
    uow.session,
  );
}

export async function settleSimulatedPayment(order: OrderLean, outcome: SettlementOutcome) {
  await runUnitOfWork(async (uow) => {
    const reason = outcome === 'FAILURE' ? 'Simulated payment declined' : undefined;
    await claimPendingPayment(order._id, outcome, reason, uow);

    if (outcome === 'SUCCESS') {
      await Order.updateOne(
        { _id: order._id, paymentStatus: 'PENDING' },
        { $set: { paymentStatus: 'PAID' } },
        { session: uow.session },
      );
      uow.onRollback(() =>
        Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'PENDING' } }),
      );
    } else {
      await releaseUnpaidOrder(order, 'SYSTEM', uow);
    }
  });
}

export async function cancelUnpaidOrder(order: OrderLean): Promise<void> {
  await runUnitOfWork(async (uow) => {
    await claimPendingPayment(order._id, 'FAILURE', 'Cancelled by customer', uow);
    await releaseUnpaidOrder(order, 'CUSTOMER', uow);
  });
}

/** Records a vendor-level refund; the payment becomes REFUNDED once fully returned. */
export async function refundVendorShare(
  orderId: Types.ObjectId,
  amount: number,
  uow: UnitOfWork,
): Promise<void> {
  const payment = await Payment.findOneAndUpdate(
    { orderId, status: 'PAID' },
    { $inc: { refundedAmount: amount } },
    { returnDocument: 'after', session: uow.session },
  );
  if (!payment) throw conflict('This order has no refundable payment');
  uow.onRollback(() => Payment.updateOne({ orderId }, { $inc: { refundedAmount: -amount } }));

  if (toMinor(payment.refundedAmount) >= toMinor(payment.amount)) {
    await Payment.updateOne({ orderId }, { $set: { status: 'REFUNDED' } }, { session: uow.session });
    await Order.updateOne(
      { _id: orderId },
      { $set: { paymentStatus: 'REFUNDED' } },
      { session: uow.session },
    );
    uow.onRollback(async () => {
      await Payment.updateOne({ orderId }, { $set: { status: 'PAID' } });
      await Order.updateOne({ _id: orderId }, { $set: { paymentStatus: 'PAID' } });
    });
  }
}
