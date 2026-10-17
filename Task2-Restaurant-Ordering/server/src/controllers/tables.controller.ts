import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';

const tableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  locationDescription: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function getTables(req: Request, res: Response, next: NextFunction) {
  try {
    const tables = await prisma.restaurantTable.findMany({
      orderBy: { tableNumber: 'asc' },
      include: {
        _count: {
          select: {
            orders: { where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY'] } } },
            reservations: { where: { status: 'CONFIRMED' } },
          },
        },
      },
    });

    return sendSuccess(res, { tables });
  } catch (err) {
    next(err);
  }
}

export async function createTable(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = tableSchema.parse(req.body);

    const table = await prisma.restaurantTable.create({
      data: validated,
    });

    return sendCreated(res, { table }, 'Table created successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateTable(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = tableSchema.partial().parse(req.body);

    const table = await prisma.restaurantTable.update({
      where: { id },
      data: validated,
    });

    return sendSuccess(res, { table }, 'Table updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteTable(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const activeOrders = await prisma.order.count({
      where: {
        tableId: id,
        status: { in: ['CONFIRMED', 'PREPARING', 'READY'] },
      },
    });

    if (activeOrders > 0) {
      throw new BadRequestError('Cannot delete table with active dining orders.');
    }

    await prisma.restaurantTable.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Table deleted successfully');
  } catch (err) {
    next(err);
  }
}
