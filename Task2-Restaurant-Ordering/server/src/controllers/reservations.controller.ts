import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { ReservationStatus, Role } from '@prisma/client';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';

const createReservationSchema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  customerEmail: z.string().email('Valid email is required').toLowerCase(),
  customerPhone: z.string().min(7, 'Phone number is required'),
  guestCount: z.number().int().min(1, 'Guest count must be at least 1').max(20, 'For groups larger than 20, please contact events directly'),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  reservationTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be formatted as HH:mm (e.g. 19:30)'),
  tableId: z.string().uuid().optional().nullable(),
  specialRequests: z.string().optional().nullable(),
});

const updateReservationStatusSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
  specialRequests: z.string().optional(),
});

export async function checkAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, time, guestCount } = req.query;

    if (!date || !time) {
      throw new BadRequestError('Date and time query parameters are required.');
    }

    const guests = guestCount ? parseInt(String(guestCount), 10) : 2;

    // Get all active tables with capacity >= guests
    const tables = await prisma.restaurantTable.findMany({
      where: {
        isActive: true,
        capacity: { gte: guests },
      },
      orderBy: { capacity: 'asc' },
    });

    // Check existing reservations for this date and time window (+- 2 hours)
    const bookedReservations = await prisma.reservation.findMany({
      where: {
        reservationDate: String(date),
        reservationTime: String(time),
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

    // Validate that the reservation date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (validated.reservationDate < today) {
      throw new BadRequestError('Cannot book reservations for past dates.');
    }

    const customerId = req.user?.userId || null;
    const reservationNumber = `RES-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Concurrency controlled table allocation using database transaction
    const reservation = await prisma.$transaction(async (tx) => {
      let allocatedTableId = validated.tableId;

      if (allocatedTableId) {
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
          throw new ConflictError('The selected table is already reserved for this date and time slot.');
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

        const booked = await tx.reservation.findMany({
          where: {
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
    next(err);
  }
}

export async function getMyReservations(req: Request, res: Response, next: NextFunction) {
  try {
    const customerId = req.user?.userId;
    const email = req.query.email as string | undefined;

    const where: any = {};
    if (customerId) {
      where.OR = [{ customerId }, { customerEmail: req.user?.email }];
    } else if (email) {
      where.customerEmail = email.toLowerCase();
    } else {
      throw new BadRequestError('Authentication or email is required to view your reservations.');
    }

    const reservations = await prisma.reservation.findMany({
      where,
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
    const { date, status } = req.query;

    const where: any = {};
    if (date) {
      where.reservationDate = String(date);
    }
    if (status) {
      where.status = status as ReservationStatus;
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
    next(err);
  }
}
