import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

const checkoutPaymentSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  method: z.nativeEnum(PaymentMethod),
  simulateFailure: z.boolean().optional().default(false),
});

export async function processPaymentCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = checkoutPaymentSchema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: validated.orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestError('Cannot process payment for a cancelled order.');
    }

    if (order.payment && order.payment.status === PaymentStatus.SUCCESSFUL) {
      throw new BadRequestError('This order has already been paid successfully.');
    }

    const transactionRef = `TXN-DEV-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Handle failure simulation for robust QA and test coverage
    if (validated.simulateFailure) {
      const failedPayment = await prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
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
        create: {
          paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
          orderId: order.id,
          amount: order.totalAmount,
          method: validated.method,
          status: PaymentStatus.FAILED,
          transactionRef,
          gatewayResponse: JSON.stringify({
            adapter: 'DineDesk Mock Payment Adapter',
            verified: false,
            reason: 'Simulation failure requested by client tester',
            timestamp: new Date().toISOString(),
          }),
        },
      });

      return res.status(402).json({
        success: false,
        message: 'Payment transaction failed (simulated failure). Please check payment details or try another method.',
        data: { payment: failedPayment },
      });
    }

    // Process successful payment simulation
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: { orderId: order.id },
        update: {
          method: validated.method,
          status: PaymentStatus.SUCCESSFUL,
          transactionRef,
          gatewayResponse: JSON.stringify({
            adapter: 'DineDesk Mock Payment Adapter',
            verified: true,
            authCode: 'MOCK_AUTH_200',
            currency: 'INR',
            amount: Number(order.totalAmount),
            timestamp: new Date().toISOString(),
          }),
        },
        create: {
          paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
          orderId: order.id,
          amount: order.totalAmount,
          method: validated.method,
          status: PaymentStatus.SUCCESSFUL,
          transactionRef,
          gatewayResponse: JSON.stringify({
            adapter: 'DineDesk Mock Payment Adapter',
            verified: true,
            authCode: 'MOCK_AUTH_200',
            currency: 'INR',
            amount: Number(order.totalAmount),
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // Advance order status to CONFIRMED if it was PENDING
      if (order.status === OrderStatus.PENDING) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CONFIRMED,
            statusHistory: {
              create: {
                previousStatus: OrderStatus.PENDING,
                newStatus: OrderStatus.CONFIRMED,
                changedByUserId: req.user?.userId || null,
                notes: `Payment confirmed via ${validated.method} (${transactionRef})`,
              },
            },
          },
        });
      }

      return payment;
    });

    return sendSuccess(res, { payment: result }, 'Payment verified and processed successfully');
  } catch (err) {
    next(err);
  }
}

export async function getPaymentById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id }, { paymentNumber: id }, { orderId: id }],
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            customerEmail: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment record not found');
    }

    return sendSuccess(res, { payment });
  } catch (err) {
    next(err);
  }
}
