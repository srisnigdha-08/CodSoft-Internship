import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Order, OrderStatus, Reservation, Role, User } from '../models';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { localDateString } from '../utils/date';
import { containsInsensitive } from '../utils/ids';

const adminOrdersQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export async function getAdminStats(req: Request, res: Response, next: NextFunction) {
  try {
    const [totalOrders, activeOrders, revenue, todayReservations, totalCustomers, popularItems] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({
        status: { $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] },
      }),
      Order.aggregate<{ total: number }>([
        { $match: { status: OrderStatus.COMPLETED } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Reservation.countDocuments({ reservationDate: localDateString() }),
      User.countDocuments({ role: Role.CUSTOMER }),
      // Top selling items by order items quantity
      Order.aggregate<{ name: string; totalQuantity: number; totalRevenue: number }>([
        { $match: { status: { $ne: OrderStatus.CANCELLED } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.name', totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.subtotal' } } },
        { $sort: { totalQuantity: -1, _id: 1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: '$_id', totalQuantity: 1, totalRevenue: 1 } },
      ]),
    ]);

    return sendSuccess(res, {
      stats: {
        totalOrders,
        activeOrders,
        totalRevenue: Number((revenue[0]?.total ?? 0).toFixed(2)),
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

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      const term = containsInsensitive(search);
      where.$or = [{ orderNumber: term }, { customerName: term }, { customerEmail: term }];
    }

    const [total, orders] = await Promise.all([
      Order.countDocuments(where),
      Order.find(where).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limitNum).populate('payment').populate('table'),
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
    const countBy = [{ $match: { customerId: { $ne: null } } }, { $group: { _id: '$customerId', count: { $sum: 1 } } }];

    const [users, orderCounts, reservationCounts] = await Promise.all([
      User.find().sort({ createdAt: -1 }),
      Order.aggregate<{ _id: unknown; count: number }>(countBy),
      Reservation.aggregate<{ _id: unknown; count: number }>(countBy),
    ]);

    const orders = new Map(orderCounts.map((c) => [String(c._id), c.count]));
    const reservations = new Map(reservationCounts.map((c) => [String(c._id), c.count]));

    return sendSuccess(res, {
      users: users.map((user) => ({
        ...user.toJSON(),
        _count: { orders: orders.get(user.id) || 0, reservations: reservations.get(user.id) || 0 },
      })),
    });
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

    const updated = await User.findByIdAndUpdate(id, { role: validated.role }, { new: true, runValidators: true });

    if (!updated) {
      throw new NotFoundError('User not found');
    }

    return sendSuccess(res, { user: updated }, `User role updated to ${validated.role}`);
  } catch (err) {
    next(err);
  }
}
