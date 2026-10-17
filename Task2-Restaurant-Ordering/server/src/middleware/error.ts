import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || null,
    });
  }

  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      return res.status(409).json({
        success: false,
        message: `A record with this ${target} already exists.`,
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'The requested record was not found.',
      });
    }
  }

  console.error('[Unhandled Error]', err);

  return res.status(500).json({
    success: false,
    message: 'An internal server error occurred. Please try again later.',
  });
}
