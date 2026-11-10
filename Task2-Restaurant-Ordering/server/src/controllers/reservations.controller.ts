import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { Prisma, ReservationStatus } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError, ConflictError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';
import { isRealCalendarDate } from '../utils/date';

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
  .refine(isRealCalendarDate, 'Date is not a valid calendar date');
const timeField = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be formatted as HH:mm (e.g. 19:30)');

// Enforced by the partial unique index reservations_active_table_slot_key
function isSlotConflict(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    /reservationDate|reservations_active_table_slot/.test(JSON.stringify(err.meta))
  );
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
  tableId: z.string().uuid().optional().nullable(),
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
    const tables = await prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        capacity: { gte: guests },
      },
      orderBy: { capacity: 'asc' },
    });

    // A table is unavailable only for the exact same date and time slot (no duration overlap check)
    const bookedReservations = await prisma.reservation.findMany({
      where: {
        reservationDate: date,
        reservationTime: time,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        tableId: { not: null },
      },
      select: { tableId: true },
    });

    const bookedTableIds = new Set(bookedReservations.map((r) => r.tableId));

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

    const customerId = req.user?.userId || null;
    const reservationNumber = `RES-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Row locks serialize competing requests; the partial unique index is the final database-level guard
    const reservation = await prisma.$transaction(async (tx) => {
      let allocatedTableId = validated.tableId;

      if (allocatedTableId) {
        // Acquire row-level lock on the table to serialize concurrent booking requests
        await tx.$queryRaw`SELECT id FROM "restaurant_tables" WHERE id = ${allocatedTableId} FOR UPDATE`;

        // Verify requested table exists and meets capacity
        const table = await tx.restaurantTable.findUnique({
          where: { id: allocatedTableId },
        });

        if (!table || !table.isActive) {
          throw new BadRequestError('The selected table is currently not available.');
        }

        if (table.capacity < validated.guestCount) {
          throw new BadRequestError(`Selected table capacity (${table.capacity}) is insufficient for ${validated.guestCount} guests.`);
        }

        // Verify table is not already booked at this date and time
        const conflict = await tx.reservation.findFirst({
          where: {
            tableId: allocatedTableId,
            reservationDate: validated.reservationDate,
            reservationTime: validated.reservationTime,
            status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
          },
        });

        if (conflict) {
          throw new ConflictError(SLOT_TAKEN_MESSAGE);
        }
      } else {
        // Auto-allocate best fitting table
        const eligibleTables = await tx.restaurantTable.findMany({
          where: {
            isActive: true,
            capacity: { gte: validated.guestCount },
          },
          orderBy: { capacity: 'asc' },
        });

        if (eligibleTables.length === 0) {
          throw new ConflictError('No tables with sufficient capacity are available for this party size.');
        }

        // Acquire row-level lock on candidate tables to serialize concurrent allocations
        const candidateIds = eligibleTables.map((t) => t.id);
        await tx.$queryRaw`SELECT id FROM "restaurant_tables" WHERE id = ANY(${candidateIds}) ORDER BY id FOR UPDATE`;

        const booked = await tx.reservation.findMany({
          where: {
            tableId: { in: candidateIds },
            reservationDate: validated.reservationDate,
            reservationTime: validated.reservationTime,
            status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
          },
          select: { tableId: true },
        });

        const bookedIds = new Set(booked.map((b) => b.tableId));
        const freeTable = eligibleTables.find((t) => !bookedIds.has(t.id));

        if (!freeTable) {
          throw new ConflictError('No tables with sufficient capacity are available for this date and time. Please select another slot.');
        }

        allocatedTableId = freeTable.id;
      }

      const newReservation = await tx.reservation.create({
        data: {
          reservationNumber,
          customerId,
          customerName: validated.customerName,
          customerEmail: validated.customerEmail,
          customerPhone: validated.customerPhone,
          guestCount: validated.guestCount,
          reservationDate: validated.reservationDate,
          reservationTime: validated.reservationTime,
          tableId: allocatedTableId,
          specialRequests: validated.specialRequests || null,
          status: ReservationStatus.CONFIRMED, // Auto-confirmed on successful allocation
        },
        include: {
          table: true,
        },
      });

      return newReservation;
    });

    return sendCreated(res, { reservation }, 'Table reservation confirmed successfully');
  } catch (err) {
    next(isSlotConflict(err) ? new ConflictError(SLOT_TAKEN_MESSAGE) : err);
  }
}

export async function getMyReservations(req: Request, res: Response, next: NextFunction) {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { customerId: req.user!.userId },
      orderBy: [{ reservationDate: 'desc' }, { reservationTime: 'desc' }],
      include: {
        table: true,
      },
    });

    return sendSuccess(res, { reservations });
  } catch (err) {
    next(err);
  }
}

export async function getAllReservations(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, status } = reservationListQuerySchema.parse(req.query);

    const where: any = {};
    if (date) {
      where.reservationDate = date;
    }
    if (status) {
      where.status = status;
    }

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: [{ reservationDate: 'asc' }, { reservationTime: 'asc' }],
      include: {
        table: true,
        customer: {
          select: { name: true, email: true, phone: true },
        },
      },
    });

    return sendSuccess(res, { reservations });
  } catch (err) {
    next(err);
  }
}

export async function updateReservationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = updateReservationStatusSchema.parse(req.body);

    const reservation = await prisma.reservation.findFirst({
      where: { OR: [{ id }, { reservationNumber: id }] },
    });

    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    if (
      validated.status !== reservation.status &&
      !validReservationTransitions[reservation.status].includes(validated.status)
    ) {
      throw new BadRequestError(`Invalid status transition: Cannot move reservation from "${reservation.status}" to "${validated.status}".`);
    }

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: validated.status,
        specialRequests: validated.specialRequests !== undefined ? validated.specialRequests : reservation.specialRequests,
      },
      include: { table: true },
    });

    return sendSuccess(res, { reservation: updated }, `Reservation status updated to ${validated.status}`);
  } catch (err) {
    next(isSlotConflict(err) ? new ConflictError(SLOT_TAKEN_MESSAGE) : err);
  }
}

export async function cancelMyReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findFirst({
      where: { OR: [{ id }, { reservationNumber: id }] },
    });

    if (!reservation) {
      throw new NotFoundError('Reservation not found');
    }

    if (reservation.customerId !== req.user!.userId) {
      throw new ForbiddenError('You can only cancel your own reservations.');
    }

    if (!validReservationTransitions[reservation.status].includes(ReservationStatus.CANCELLED)) {
      throw new BadRequestError(`Cannot cancel a reservation in "${reservation.status}" status.`);
    }

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.CANCELLED },
      include: { table: true },
    });

    return sendSuccess(res, { reservation: updated }, 'Reservation cancelled successfully');
  } catch (err) {
    next(err);
  }
}
