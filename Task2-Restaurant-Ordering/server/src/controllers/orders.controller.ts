import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Order, OrderStatus, OrderStatusHistory, OrderType, MenuItem, Payment, PaymentMethod, PaymentStatus, RestaurantTable } from '../models';
import { randomObjectId } from '../models/shared';
import { runAtomic } from '../db';
import { transitionOrder } from '../services/orderTransitions';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';
import { assertRecordAccess } from '../utils/access';
import { idOrField, objectIdSchema } from '../utils/ids';

const MAX_ITEM_QUANTITY = 50;

const createOrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Name is required').max(100),
  customerEmail: z.string().email('Valid email is required').toLowerCase(),
  customerPhone: z.string().trim().regex(/^[+\d][\d\s()-]{6,19}$/, 'Valid contact number is required'),
  orderType: z.nativeEnum(OrderType),
  tableId: objectIdSchema('Invalid table ID').optional().nullable(),
  deliveryAddress: z.string().max(500).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.MOCK_ONLINE),
  simulatePaymentFailure: z.boolean().optional().default(false),
  items: z.array(
    z.object({
      menuItemId: objectIdSchema('Invalid menu item ID'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1').max(MAX_ITEM_QUANTITY, `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`),
      notes: z.string().max(300).optional().nullable(),
    })
  ).min(1, 'Order must contain at least one item').max(50, 'Order contains too many items'),
});

const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1).max(300).optional(),
});

const historyAscending = { sort: { createdAt: 1, _id: 1 } };

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = createOrderSchema.parse(req.body);

    if (validated.orderType === OrderType.DELIVERY && (!validated.deliveryAddress || validated.deliveryAddress.trim().length < 5)) {
      throw new BadRequestError('A complete delivery address is required for delivery orders.');
    }

    if (validated.orderType === OrderType.DINE_IN && validated.tableId) {
      const table = await RestaurantTable.findById(validated.tableId);
      if (!table || !table.isActive) {
        throw new BadRequestError('Selected table is unavailable.');
      }
    }

    // Retrieve and validate all menu items from database
    const itemIds = [...new Set(validated.items.map((i) => i.menuItemId.toLowerCase()))];
    const dbMenuItems = await MenuItem.find({ _id: { $in: itemIds } });

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
    const menuItemsMap = new Map(dbMenuItems.map((item) => [item.id as string, item]));
    let subtotalNum = 0;

    const orderItemsData = validated.items.map((item) => {
      const dbItem = menuItemsMap.get(item.menuItemId.toLowerCase())!;
      const unitPrice = dbItem.price;
      const lineSubtotal = Number((unitPrice * item.quantity).toFixed(2));
      subtotalNum = Number((subtotalNum + lineSubtotal).toFixed(2));

      return {
        menuItemId: dbItem._id,
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
    const orderId = randomObjectId();

    const isOnlinePayment = validated.paymentMethod !== PaymentMethod.CASH;
    const isSimulatedFailure = isOnlinePayment && validated.simulatePaymentFailure;
    const isMockSuccess = isOnlinePayment && !isSimulatedFailure;

    // Order, payment and initial status history are persisted as one unit
    await runAtomic(
      async (session) => {
        await Order.create(
          [
            {
              _id: orderId,
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
              items: orderItemsData,
            },
          ],
          { session }
        );

        await Payment.create(
          [
            {
              paymentNumber,
              orderId,
              customerId,
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
          ],
          { session }
        );

        await OrderStatusHistory.insertMany(
          [
            {
              orderId,
              previousStatus: null,
              newStatus: OrderStatus.PENDING,
              changedByUserId: customerId,
              notes: 'Order initiated by customer',
            },
            ...(isMockSuccess
              ? [
                  {
                    orderId,
                    previousStatus: OrderStatus.PENDING,
                    newStatus: OrderStatus.CONFIRMED,
                    changedByUserId: customerId,
                    notes: 'Simulated payment succeeded; order automatically confirmed',
                  },
                ]
              : []),
          ],
          { session }
        );
      },
      async () => {
        await Promise.all([
          Order.deleteOne({ _id: orderId }),
          Payment.deleteOne({ orderId }),
          OrderStatusHistory.deleteMany({ orderId }),
        ]);
      }
    );

    const order = await Order.findById(orderId)
      .populate('payment')
      .populate('table')
      .populate({ path: 'statusHistory', options: historyAscending });

    return sendCreated(res, { order }, 'Order placed successfully');
  } catch (err) {
    next(err);
  }
}

export async function getMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await Order.find({ customerId: req.user!.userId })
      .sort({ createdAt: -1, _id: -1 })
      .populate('payment')
      .populate('table')
      .populate({ path: 'statusHistory', options: { sort: { createdAt: -1, _id: -1 } } });

    return sendSuccess(res, { orders });
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const order = await Order.findOne(idOrField(id, 'orderNumber'))
      .populate('items.menuItem')
      .populate('payment')
      .populate('table')
      .populate({
        path: 'statusHistory',
        options: historyAscending,
        populate: { path: 'changedBy', select: 'name role' },
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

    const order = await Order.findOne(idOrField(id, 'orderNumber'));

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    assertRecordAccess(req.user, order.customerId, id === order.id);

    // Only allow cancellation in PENDING or CONFIRMED state
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestError(`Cannot cancel order in "${order.status}" status. Only PENDING or CONFIRMED orders can be cancelled.`);
    }

    const payment = await Payment.findOne({ orderId: order._id });

    await transitionOrder({
      orderId: order._id,
      from: order.status,
      to: OrderStatus.CANCELLED,
      changedByUserId: req.user?.userId || null,
      notes: reason,
      conflictMessage: 'This order was just updated by the kitchen and can no longer be cancelled.',
      payment:
        payment && payment.status === PaymentStatus.SUCCESSFUL
          ? {
              id: payment._id,
              previousStatus: payment.status,
              previousGatewayResponse: payment.gatewayResponse,
              status: PaymentStatus.REFUNDED,
              gatewayResponse: JSON.stringify({
                simulated: true,
                refunded: true,
                refundReason: reason,
                timestamp: new Date().toISOString(),
              }),
            }
          : undefined,
    });

    const updatedOrder = await Order.findById(order._id)
      .populate('payment')
      .populate({ path: 'statusHistory', options: historyAscending });

    return sendSuccess(res, { order: updatedOrder }, 'Order cancelled successfully');
  } catch (err) {
    next(err);
  }
}
