import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Order, OrderStatus, OrderStatusHistory, Payment, PaymentMethod, PaymentStatus } from '../models';
import { runAtomic } from '../db';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { assertRecordAccess } from '../utils/access';
import { isObjectIdString, objectIdSchema } from '../utils/ids';

const checkoutPaymentSchema = z.object({
  orderId: objectIdSchema('Invalid order ID'),
  method: z.nativeEnum(PaymentMethod),
  simulateFailure: z.boolean().optional().default(false),
});

export async function processPaymentCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = checkoutPaymentSchema.parse(req.body);

    const order = await Order.findById(validated.orderId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    assertRecordAccess(req.user, order.customerId, true);

    if (validated.method === PaymentMethod.CASH) {
      throw new BadRequestError('Cash is collected at handover and cannot be processed online.');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestError('Cannot process payment for a cancelled order.');
    }

    const existingPayment = await Payment.findOne({ orderId: order._id });

    if (existingPayment && existingPayment.status === PaymentStatus.SUCCESSFUL) {
      throw new BadRequestError('This order has already been paid successfully.');
    }

    const transactionRef = `TXN-DEV-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const newRecordFields = {
      paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
      amount: order.totalAmount,
      customerId: order.customerId,
    };

    // Handle failure simulation for robust QA and test coverage
    if (validated.simulateFailure) {
      const failedPayment = await Payment.findOneAndUpdate(
        { orderId: order._id },
        {
          $set: {
            method: validated.method,
            status: PaymentStatus.FAILED,
            transactionRef,
            gatewayResponse: JSON.stringify({
              adapter: 'DineDesk Mock Payment Adapter',
              verified: false,
              reason: 'Card declined / simulation failure requested by client tester',
              timestamp: new Date().toISOString(),
            }),
          },
          $setOnInsert: newRecordFields,
        },
        { upsert: true, new: true }
      );

      return res.status(402).json({
        success: false,
        message: 'Payment transaction failed (simulated failure). Please check payment details or try another method.',
        data: { payment: failedPayment },
      });
    }

    // Process successful payment simulation
    const historyId = new Types.ObjectId();
    let orderConfirmed = false;

    const payment = await runAtomic(
      async (session) => {
        const saved = await Payment.findOneAndUpdate(
          { orderId: order._id },
          {
            $set: {
              method: validated.method,
              status: PaymentStatus.SUCCESSFUL,
              transactionRef,
              gatewayResponse: JSON.stringify({
                adapter: 'DineDesk Mock Payment Adapter',
                verified: true,
                authCode: 'MOCK_AUTH_200',
                currency: 'INR',
                amount: order.totalAmount,
                timestamp: new Date().toISOString(),
              }),
            },
            $setOnInsert: newRecordFields,
          },
          { upsert: true, new: true, session }
        );

        // Advance order status to CONFIRMED if it was PENDING
        const { modifiedCount } = await Order.updateOne(
          { _id: order._id, status: OrderStatus.PENDING },
          { status: OrderStatus.CONFIRMED },
          { session }
        );
        if (modifiedCount > 0) {
          orderConfirmed = true;
          await OrderStatusHistory.create(
            [
              {
                _id: historyId,
                orderId: order._id,
                previousStatus: OrderStatus.PENDING,
                newStatus: OrderStatus.CONFIRMED,
                changedByUserId: req.user?.userId || null,
                notes: `Payment confirmed via ${validated.method} (${transactionRef})`,
              },
            ],
            { session }
          );
        }

        return saved;
      },
      async () => {
        if (existingPayment) {
          await Payment.updateOne(
            { _id: existingPayment._id },
            {
              method: existingPayment.method,
              status: existingPayment.status,
              transactionRef: existingPayment.transactionRef,
              gatewayResponse: existingPayment.gatewayResponse,
            }
          );
        } else {
          await Payment.deleteOne({ orderId: order._id });
        }
        if (orderConfirmed) {
          await Order.updateOne({ _id: order._id, status: OrderStatus.CONFIRMED }, { status: OrderStatus.PENDING });
          await OrderStatusHistory.deleteOne({ _id: historyId });
        }
      }
    );

    return sendSuccess(res, { payment }, 'Payment verified and processed successfully');
  } catch (err) {
    next(err);
  }
}

export async function getPaymentById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const conditions: Record<string, unknown>[] = [{ paymentNumber: id }];
    if (isObjectIdString(id)) {
      conditions.push({ _id: id }, { orderId: id });
    }

    const payment = await Payment.findOne({ $or: conditions }).populate({
      path: 'order',
      select: 'orderNumber customerName customerEmail totalAmount status customerId',
    });

    if (!payment) {
      throw new NotFoundError('Payment record not found');
    }

    assertRecordAccess(req.user, payment.customerId, id === payment.id || id === String(payment.orderId));

    return sendSuccess(res, { payment });
  } catch (err) {
    next(err);
  }
}
