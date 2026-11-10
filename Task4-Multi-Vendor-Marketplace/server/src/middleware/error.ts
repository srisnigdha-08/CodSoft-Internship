import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError, notFound } from '../utils/AppError.js';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

const body = (code: string, message: string, details?: unknown): ErrorBody => ({
  error: { code, message, ...(details === undefined ? {} : { details }) },
});

export const notFoundHandler: RequestHandler = (req) => {
  throw notFound(`Route ${req.method} ${req.path}`);
};

const isDuplicateKey = (err: unknown): err is { code: 11000; keyValue?: Record<string, unknown> } =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;

const isBodyParseError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.parse.failed';

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(body(err.code, err.message, err.details));
    return;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(422).json(body('VALIDATION_ERROR', 'Some fields are invalid', details));
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
    res.status(422).json(body('VALIDATION_ERROR', 'Some fields are invalid', details));
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json(body('BAD_REQUEST', `Invalid value for ${err.path}`));
    return;
  }
  if (isDuplicateKey(err)) {
    const fields = Object.keys(err.keyValue ?? {}).join(', ') || 'value';
    res.status(409).json(body('CONFLICT', `That ${fields} is already in use`));
    return;
  }
  if (isBodyParseError(err)) {
    res.status(400).json(body('BAD_REQUEST', 'Request body is not valid JSON'));
    return;
  }

  console.error(err);
  res.status(500).json(body('INTERNAL_ERROR', 'Something went wrong'));
};
