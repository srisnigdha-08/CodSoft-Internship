import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Reservation, ReservationStatus, RestaurantTable, RESERVATION_SLOT_INDEX } from '../models';
import { BadRequestError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';
import { isRealCalendarDate } from '../utils/date';
import { idOrField, objectIdSchema } from '../utils/ids';

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
  .refine(isRealCalendarDate, 'Date is not a valid calendar date');
const timeField = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be formatted as HH:mm (e.g. 19:30)');

const ACTIVE_STATUSES = [ReservationStatus.PENDING, ReservationStatus.CONFIRMED];

// Enforced by the partial unique index on active reservations
function isSlotConflict(err: unknown) {
  const error = err as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  return error?.code === 11000 && (Boolean(error.keyPattern?.reservationDate) || Boolean(error.message?.includes(RESERVATION_SLOT_INDEX)));
}

const SLOT_TAKEN_MESSAGE = 'The selected table is already reserved for this date and time slot.';

const validReservationTransitions: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.PENDING]: [ReservationStatus.CONFIRMED, ReservationStatus.CANCELLED],
  [ReservationStatus.CONFIRMED]: [ReservationStatus.COMPLETED, ReservationStatus.CANCELLED],
  [ReservationStatus.COMPLETED]: [],
  [ReservationStatus.CANCELLED]: [],
};

const createReservationSchema = z.object({
  customerName: z.string().trim().min(2, 'Name is required').max(100),
  customerEmail: z.string().email('Valid email is required').toLowerCase(),
  customerPhone: z.string().trim().regex(/^[+\d][\d\s()-]{6,19}$/, 'A valid phone number is required'),
  guestCount: z.number().int().min(1, 'Guest count must be at least 1').max(20, 'For groups larger than 20, please contact events directly'),
  reservationDate: dateField,
  reservationTime: timeField,
  tableId: objectIdSchema('Invalid table ID').optional().nullable(),
  specialRequests: z.string().max(500).optional().nullable(),
});

const availabilityQuerySchema = z.object({
  date: dateField,
  time: timeField,
  guestCount: z.coerce.number().int().min(1).max(20).default(2),
});

const reservationListQuerySchema = z.object({
  date: dateField.optional(),
  status: z.nativeEnum(ReservationStatus).optional(),
});

const updateReservationStatusSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
  specialRequests: z.string().max(500).optional(),
});

export async function checkAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, time, guestCount: guests } = availabilityQuerySchema.parse(req.query);

    // Get all active tables with capacity >= guests
    const tables = await RestaurantTable.find({ isActive: true, capacity: { $gte: guests } }).sort({ capacity: 1, tableNumber: 1 });

    // A table is unavailable only for the exact same date and time slot (no duration overlap check)
    const bookedReservations = await Reservation.find({
      reservationDate: date,
      reservationTime: time,
      status: { $in: ACTIVE_STATUSES },
      tableId: { $ne: null },
    }).select('tableId');

    const bookedTableIds = new Set(bookedReservations.map((r) => String(r.tableId)));
    const availableTables = tables.filter((table) => !bookedTableIds.has(table.id));

    return sendSuccess(res, {
      date,
      time,
      guestCount: guests,
      available: availableTables.length > 0,
      availableTables,
      totalCapacity: tables.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function createReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = createReservationSchema.parse(req.body);

    // Compared in the server's local time zone (the restaurant's time zone)
    if (new Date(`${validated.reservationDate}T${validated.reservationTime}:00`) < new Date()) {
      throw new BadRequestError('Reservations must be for a future date and time.');
    }

    const reservationNumber = `RES-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const insertFor = (tableId: unknown) =>
      Reservation.create({
        reservationNumber,
        customerId: req.user?.userId || null,
        customerName: validated.customerName,
        customerEmail: validated.customerEmail,
        customerPhone: validated.customerPhone,
        guestCount: validated.guestCount,
        reservationDate: validated.reservationDate,
        reservationTime: validated.reservationTime,
        tableId,
        specialRequests: validated.specialRequests || null,
        status: ReservationStatus.CONFIRMED, // Auto-confirmed on successful allocation
      });

    let created;

    if (validated.tableId) {
      const table = await RestaurantTable.findById(validated.tableId);

      if (!table || !table.isActive) {
        throw new BadRequestError('The selected table is currently not available.');
      }

      if (table.capacity < validated.guestCount) {
        throw new BadRequestError(`Selected table capacity (${table.capacity}) is insufficient for ${validated.guestCount} guests.`);
      }

      // The unique index rejects the insert if the table is already held for this exact slot
      created = await insertFor(table._id);
    } else {
      // Auto-allocate best fitting table
      const eligibleTables = await RestaurantTable.find({
        isActive: true,
        capacity: { $gte: validated.guestCount },
      }).sort({ capacity: 1, tableNumber: 1 });

      if (eligibleTables.length === 0) {
        throw new ConflictError('No tables with sufficient capacity are available for this party size.');
      }

      // Try each table in turn. Concurrent requests that lose a table move on to the next one.
      for (const table of eligibleTables) {
        try {
          created = await insertFor(table._id);
          break;
        } catch (err) {
          if (!isSlotConflict(err)) {
            throw err;
          }
        }
      }

      if (!created) {
        throw new ConflictError('No tables with sufficient capacity are available for this date and time. Please select another slot.');
      }
    }

    const reservation = await Reservation.findById(created._id).populate('table');

    return sendCreated(res, { reservation }, 'Table reservation confirmed successfully');
  } catch (err) {
    next(isSlotConflict(err) ? new ConflictError(SLOT_TAKEN_MESSAGE) : err);
  }
}

export async function getMyReservations(req: Request, res: Response, next: NextFunction) {
  try {
    const reservations = await Reservation.find({ customerId: req.user!.userId })
      .sort({ reservationDate: -1, reservationTime: -1 })
      .populate('table');

    return sendSuccess(res, { reservations });
  } catch (err) {
    next(err);
  }
}

export async function getAllReservations(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, status } = reservationListQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (date) {
      where.reservationDate = date;
    }
    if (status) {
      where.status = status;
    }

    const reservations = await Reservation.find(where)
      .sort({ reservationDate: 1, reservationTime: 1 })
      .populate('table')
      .populate({ path: 'customer', select: 'name email phone' });

    return sendSuccess(res, { reservations });
  } catch (err) {
    next(err);
  }
}

export async function updateReservationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = updateReservationStatusSchema.parse(req.body);

    const reservation = await Reservation.findOne(idOrField(id, 'reservationNumber'));

    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    if (
      validated.status !== reservation.status &&
      !validReservationTransitions[reservation.status].includes(validated.status)
    ) {
      throw new BadRequestError(`Invalid status transition: Cannot move reservation from "${reservation.status}" to "${validated.status}".`);
    }

    reservation.status = validated.status;
    if (validated.specialRequests !== undefined) {
      reservation.specialRequests = validated.specialRequests;
    }
    await reservation.save();
    await reservation.populate('table');

    return sendSuccess(res, { reservation }, `Reservation status updated to ${validated.status}`);
  } catch (err) {
    next(isSlotConflict(err) ? new ConflictError(SLOT_TAKEN_MESSAGE) : err);
  }
}

export async function cancelMyReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findOne(idOrField(id, 'reservationNumber'));

    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    if (String(reservation.customerId) !== req.user!.userId) {
      throw new ForbiddenError('You can only cancel your own reservations.');
    }

    if (!validReservationTransitions[reservation.status].includes(ReservationStatus.CANCELLED)) {
      throw new BadRequestError(`Cannot cancel a reservation in "${reservation.status}" status.`);
    }

    reservation.status = ReservationStatus.CANCELLED;
    await reservation.save();
    await reservation.populate('table');

    return sendSuccess(res, { reservation }, 'Reservation cancelled successfully');
  } catch (err) {
    next(err);
  }
}
