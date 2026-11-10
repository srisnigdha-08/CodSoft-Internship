import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus } from '@prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';
import { assertRecordAccess } from '../utils/access';

const MAX_ITEM_QUANTITY = 50;

const createOrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Name is required').max(100),
  customerEmail: z.string().email('Valid email is required').toLowerCase(),
  customerPhone: z.string().trim().regex(/^[+\d][\d\s()-]{6,19}$/, 'Valid contact number is required'),
  orderType: z.nativeEnum(OrderType),
  tableId: z.string().uuid().optional().nullable(),
  deliveryAddress: z.string().max(500).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.MOCK_ONLINE),
  simulatePaymentFailure: z.boolean().optional().default(false),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid('Invalid menu item ID'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1').max(MAX_ITEM_QUANTITY, `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`),
      notes: z.string().max(300).optional().nullable(),
    })
  ).min(1, 'Order must contain at least one item').max(50, 'Order contains too many items'),
});

const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1).max(300).optional(),
});

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = createOrderSchema.parse(req.body);

    if (validated.orderType === OrderType.DELIVERY && (!validated.deliveryAddress || validated.deliveryAddress.trim().length < 5)) {
      throw new BadRequestError('A complete delivery address is required for delivery orders.');
    }

    if (validated.orderType === OrderType.DINE_IN && validated.tableId) {
      const table = await prisma.restaurantTable.findUnique({
        where: { id: validated.tableId },
      });
      if (!table || !table.isActive) {
        throw new BadRequestError('Selected table is unavailable.');
      }
    }

    // Retrieve and validate all menu items from database
    const itemIds = [...new Set(validated.items.map((i) => i.menuItemId))];
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
    });

    if (dbMenuItems.length !== itemIds.length) {
      throw new BadRequestError('One or more selected menu items do not exist.');
    }

    // Check availability
    for (const dbItem of dbMenuItems) {
      if (!dbItem.isAvailable) {
        throw new BadRequestError(`"${dbItem.name}" is currently sold out and cannot be ordered.`);
      }
    }

    // Recalculate totals on server
    const menuItemsMap = new Map(dbMenuItems.map((item) => [item.id, item]));
    let subtotalNum = 0;

    const orderItemsData = validated.items.map((item) => {
      const dbItem = menuItemsMap.get(item.menuItemId)!;
      const unitPrice = Number(dbItem.price);
      const lineSubtotal = Number((unitPrice * item.quantity).toFixed(2));
      subtotalNum = Number((subtotalNum + lineSubtotal).toFixed(2));

      return {
        menuItemId: dbItem.id,
        name: dbItem.name,
        price: dbItem.price,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        notes: item.notes || null,
      };
    });

    const taxNum = Number((subtotalNum * 0.05).toFixed(2)); // 5% GST
    const deliveryFeeNum = validated.orderType === OrderType.DELIVERY ? 40.00 : 0.00;
    const totalAmountNum = Number((subtotalNum + taxNum + deliveryFeeNum).toFixed(2));

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const customerId = req.user?.userId || null;

    // Database transaction to atomically persist Order, OrderItems, Payment, and Initial Status
    const result = await prisma.$transaction(async (tx) => {
      const isOnlinePayment = validated.paymentMethod !== PaymentMethod.CASH;
      const isSimulatedFailure = isOnlinePayment && validated.simulatePaymentFailure;
      const isMockSuccess = isOnlinePayment && !isSimulatedFailure;

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          customerName: validated.customerName,
          customerEmail: validated.customerEmail,
          customerPhone: validated.customerPhone,
          orderType: validated.orderType,
          tableId: validated.orderType === OrderType.DINE_IN ? validated.tableId || null : null,
          deliveryAddress: validated.orderType === OrderType.DELIVERY ? validated.deliveryAddress!.trim() : null,
          status: isMockSuccess ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
          subtotal: subtotalNum,
          tax: taxNum,
          deliveryFee: deliveryFeeNum,
          totalAmount: totalAmountNum,
          notes: validated.notes || null,
          items: {
            create: orderItemsData,
          },
          payment: {
            create: {
              paymentNumber,
              amount: totalAmountNum,
              method: validated.paymentMethod,
              status: isMockSuccess
                ? PaymentStatus.SUCCESSFUL
                : isSimulatedFailure
                ? PaymentStatus.FAILED
                : PaymentStatus.PENDING,
              transactionRef: isMockSuccess ? `TXN-MOCK-${Math.random().toString(36).substring(2, 10).toUpperCase()}` : null,
              gatewayResponse: JSON.stringify({
                adapter: 'DineDesk Development Mock Payment Gateway',
                mockMode: true,
                message: isMockSuccess
                  ? 'Payment simulated successfully'
                  : isSimulatedFailure
                  ? 'Payment failure simulated on request'
                  : 'Payment pending on cash handover',
                timestamp: new Date().toISOString(),
              }),
            },
          },
          statusHistory: {
            create: [
              {
                previousStatus: null,
                newStatus: OrderStatus.PENDING,
                changedByUserId: customerId,
                notes: 'Order initiated by customer',
              },
              ...(isMockSuccess
                ? [
                    {
                      previousStatus: OrderStatus.PENDING,
                      newStatus: OrderStatus.CONFIRMED,
                      changedByUserId: customerId,
                      notes: 'Simulated payment succeeded; order automatically confirmed',
                    },
                  ]
                : []),
            ],
          },
        },
        include: {
          items: true,
          payment: true,
          table: true,
          statusHistory: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return order;
    });

    return sendCreated(res, { order: result }, 'Order placed successfully');
  } catch (err) {
    next(err);
  }
}

export async function getMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payment: true,
        table: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return sendSuccess(res, { orders });
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        payment: true,
        table: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          include: {
            changedBy: {
              select: { name: true, role: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    assertRecordAccess(req.user, order.customerId, id === order.id);

    return sendSuccess(res, { order });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const reason = cancelOrderSchema.parse(req.body ?? {}).reason || 'Cancelled by customer';

    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    assertRecordAccess(req.user, order.customerId, id === order.id);

    // Only allow cancellation in PENDING or CONFIRMED state
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestError(`Cannot cancel order in "${order.status}" status. Only PENDING or CONFIRMED orders can be cancelled.`);
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Conditional update: fails if the kitchen advanced the order after it was read above
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: OrderStatus.CANCELLED },
      });
      if (count === 0) {
        throw new ConflictError('This order was just updated by the kitchen and can no longer be cancelled.');
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: OrderStatus.CANCELLED,
          changedByUserId: req.user?.userId || null,
          notes: reason,
        },
      });

      if (order.payment && order.payment.status === PaymentStatus.SUCCESSFUL) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            status: PaymentStatus.REFUNDED,
            gatewayResponse: JSON.stringify({
              simulated: true,
              refunded: true,
              refundReason: reason,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, payment: true, statusHistory: true },
      });
    });

    return sendSuccess(res, { order: updatedOrder }, 'Order cancelled successfully');
  } catch (err) {
    next(err);
  }
}
