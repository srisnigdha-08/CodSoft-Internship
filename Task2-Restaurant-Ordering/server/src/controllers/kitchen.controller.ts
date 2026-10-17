import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { OrderStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { sendSuccess } from '../utils/response';

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
  notes: z.string().optional(),
});

export async function getKitchenOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) {
      where.status = status as OrderStatus;
    } else {
      // By default, kitchen sees active orders that require preparation
      where.status = {
        in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY],
      };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' }, // FIFO: oldest orders first
      include: {
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                preparationTimeMinutes: true,
                isVegetarian: true,
              },
            },
          },
        },
        table: true,
        payment: {
          select: {
            method: true,
            status: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return sendSuccess(res, { orders });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = updateStatusSchema.parse(req.body);

    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
    });

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

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: targetStatus,
          statusHistory: {
            create: {
              previousStatus: currentStatus,
              newStatus: targetStatus,
              changedByUserId: req.user?.userId || null,
              notes: validated.notes || `Order advanced to ${targetStatus} by kitchen staff`,
            },
          },
        },
        include: {
          items: true,
          table: true,
          payment: true,
          statusHistory: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return updated;
    });

    return sendSuccess(res, { order: updatedOrder }, `Order status updated to ${targetStatus}`);
  } catch (err) {
    next(err);
  }
}
