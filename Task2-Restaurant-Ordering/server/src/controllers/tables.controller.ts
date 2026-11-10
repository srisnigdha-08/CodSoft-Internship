import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Order, OrderStatus, Reservation, ReservationStatus, RestaurantTable } from '../models';
import { runAtomic } from '../db';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';
import { localDateString } from '../utils/date';

const ACTIVE_DINING_STATUSES = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY];

const tableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(50, 'Capacity cannot exceed 50'),
  locationDescription: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function getTables(req: Request, res: Response, next: NextFunction) {
  try {
    const [tables, orderCounts, reservationCounts] = await Promise.all([
      RestaurantTable.find().sort({ tableNumber: 1 }),
      Order.aggregate<{ _id: unknown; count: number }>([
        { $match: { tableId: { $ne: null }, status: { $in: ACTIVE_DINING_STATUSES } } },
        { $group: { _id: '$tableId', count: { $sum: 1 } } },
      ]),
      Reservation.aggregate<{ _id: unknown; count: number }>([
        { $match: { tableId: { $ne: null }, status: ReservationStatus.CONFIRMED } },
        { $group: { _id: '$tableId', count: { $sum: 1 } } },
      ]),
    ]);

    const orders = new Map(orderCounts.map((c) => [String(c._id), c.count]));
    const reservations = new Map(reservationCounts.map((c) => [String(c._id), c.count]));

    return sendSuccess(res, {
      tables: tables.map((table) => ({
        ...table.toJSON(),
        _count: { orders: orders.get(table.id) || 0, reservations: reservations.get(table.id) || 0 },
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function createTable(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = tableSchema.parse(req.body);

    const table = await RestaurantTable.create(validated);

    return sendCreated(res, { table }, 'Table created successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateTable(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = tableSchema.partial().parse(req.body);

    const table = await RestaurantTable.findByIdAndUpdate(id, validated, { new: true, runValidators: true });
    if (!table) {
      throw new NotFoundError('The requested record was not found.');
    }

    return sendSuccess(res, { table }, 'Table updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteTable(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const table = await RestaurantTable.findById(id);
    if (!table) {
      throw new NotFoundError('The requested record was not found.');
    }

    const activeOrders = await Order.countDocuments({ tableId: table._id, status: { $in: ACTIVE_DINING_STATUSES } });

    if (activeOrders > 0) {
      throw new BadRequestError('Cannot delete table with active dining orders.');
    }

    const upcomingReservations = await Reservation.countDocuments({
      tableId: table._id,
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      reservationDate: { $gte: localDateString() },
    });

    if (upcomingReservations > 0) {
      throw new BadRequestError('Cannot delete a table with upcoming reservations.');
    }

    // Past orders and bookings stay on record without a table link
    await runAtomic(async (session) => {
      await Order.updateMany({ tableId: table._id }, { tableId: null }, { session });
      await Reservation.updateMany({ tableId: table._id }, { tableId: null, holdsSlot: false }, { session });
      await RestaurantTable.deleteOne({ _id: table._id }, { session });
    });

    return sendSuccess(res, null, 'Table deleted successfully');
  } catch (err) {
    next(err);
  }
}
