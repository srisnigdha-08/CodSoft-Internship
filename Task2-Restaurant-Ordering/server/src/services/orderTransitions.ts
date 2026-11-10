import { Types } from 'mongoose';
import { runAtomic } from '../db';
import { Order, OrderStatus, OrderStatusHistory, Payment, PaymentStatus } from '../models';
import { ConflictError } from '../utils/errors';

interface PaymentChange {
  id: Types.ObjectId;
  previousStatus: PaymentStatus;
  previousGatewayResponse?: string | null;
  status: PaymentStatus;
  gatewayResponse?: string;
}

interface TransitionInput {
  orderId: Types.ObjectId;
  from: OrderStatus;
  to: OrderStatus;
  changedByUserId: string | null;
  notes: string;
  conflictMessage: string;
  payment?: PaymentChange;
}

/**
 * Moves an order to a new status, records the history entry, and applies any payment change.
 * The update is conditional on the status that was read, so concurrent changes cannot both succeed.
 */
export async function transitionOrder(input: TransitionInput): Promise<void> {
  const { orderId, from, to, changedByUserId, notes, conflictMessage, payment } = input;
  const historyId = new Types.ObjectId();
  let statusApplied = false;

  await runAtomic(
    async (session) => {
      const { modifiedCount } = await Order.updateOne({ _id: orderId, status: from }, { status: to }, { session });
      if (modifiedCount === 0) {
        throw new ConflictError(conflictMessage);
      }
      statusApplied = true;

      await OrderStatusHistory.create(
        [{ _id: historyId, orderId, previousStatus: from, newStatus: to, changedByUserId, notes }],
        { session }
      );

      if (payment) {
        const update: Record<string, unknown> = { status: payment.status };
        if (payment.gatewayResponse !== undefined) {
          update.gatewayResponse = payment.gatewayResponse;
        }
        await Payment.updateOne({ _id: payment.id }, update, { session });
      }
    },
    async () => {
      if (!statusApplied) {
        return;
      }
      await Order.updateOne({ _id: orderId, status: to }, { status: from });
      await OrderStatusHistory.deleteOne({ _id: historyId });
      if (payment) {
        await Payment.updateOne(
          { _id: payment.id },
          { status: payment.previousStatus, gatewayResponse: payment.previousGatewayResponse ?? null }
        );
      }
    }
  );
}
