import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/errors';

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

  // Malformed or oversized request bodies rejected by express.json()
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body contains invalid JSON.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large.' });
  }

  // Unique index violation
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern ?? {}).join(', ') || 'value';
    return res.status(409).json({
      success: false,
      message: `A record with this ${fields} already exists.`,
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }

  // A malformed id in the URL can never match a record
  if (err instanceof mongoose.Error.CastError) {
    if (err.path === '_id') {
      return res.status(404).json({ success: false, message: 'The requested record was not found.' });
    }
    return res.status(400).json({ success: false, message: `Invalid value for ${err.path}.` });
  }

  console.error('[Unhandled Error]', err);

  return res.status(500).json({
    success: false,
    message: 'An internal server error occurred. Please try again later.',
  });
}
