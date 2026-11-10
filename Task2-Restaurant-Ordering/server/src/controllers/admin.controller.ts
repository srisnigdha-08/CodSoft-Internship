import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { OrderStatus, Role } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { localDateString } from '../utils/date';

const adminOrdersQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export async function getAdminStats(req: Request, res: Response, next: NextFunction) {
  try {
    const totalOrders = await prisma.order.count();
    const activeOrders = await prisma.order.count({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] },
      },
    });

    const completedOrders = await prisma.order.findMany({
      where: { status: OrderStatus.COMPLETED },
      select: { totalAmount: true },
    });

    const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const todayStr = localDateString();
    const todayReservations = await prisma.reservation.count({
      where: { reservationDate: todayStr },
    });

    const totalCustomers = await prisma.user.count({
      where: { role: Role.CUSTOMER },
    });

    // Top selling items by order items quantity
    const orderItemsGrouped = await prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { status: { not: OrderStatus.CANCELLED } } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const popularItems = orderItemsGrouped.map((item) => ({
      name: item.name,
      totalQuantity: item._sum.quantity || 0,
      totalRevenue: item._sum.subtotal || 0,
    }));

    return sendSuccess(res, {
      stats: {
        totalOrders,
        activeOrders,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        todayReservations,
        totalCustomers,
        popularItems,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, search, page: pageNum, limit: limitNum } = adminOrdersQuerySchema.parse(req.query);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      const term = search;
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { customerName: { contains: term, mode: 'insensitive' } },
        { customerEmail: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          payment: true,
          table: true,
        },
      }),
    ]);

    return sendSuccess(res, {
      orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAdminUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        _count: {
          select: { orders: true, reservations: true },
        },
      },
    });

    return sendSuccess(res, { users });
  } catch (err) {
    next(err);
  }
}

const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = updateUserRoleSchema.parse(req.body);

    // Prevents an administrator from accidentally locking everyone out of the admin area
    if (id === req.user?.userId) {
      throw new BadRequestError('You cannot change your own role.');
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: validated.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });

    return sendSuccess(res, { user: updated }, `User role updated to ${validated.role}`);
  } catch (err) {
    next(err);
  }
}
