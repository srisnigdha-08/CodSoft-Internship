import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError, type FieldError } from '../utils/apiError.js';

interface ErrorBody {
  status: number;
  message: string;
  errors?: FieldError[];
}

function fromMulterError(error: MulterError): ErrorBody {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return { status: 413, message: `The file must be ${env.MAX_RESUME_SIZE_MB} MB or smaller` };
  }
  return { status: 422, message: 'The upload could not be processed' };
}

function fromPrismaError(error: Prisma.PrismaClientKnownRequestError): ErrorBody | null {
  switch (error.code) {
    case 'P2002':
      return { status: 409, message: 'A record with these details already exists' };
    case 'P2003':
    case 'P2014':
      return { status: 409, message: 'This record is still referenced by other data' };
    case 'P2034':
      return { status: 409, message: 'This record was just changed. Please try again.' };
    case 'P2025':
      return { status: 404, message: 'Resource not found' };
    default:
      return null;
  }
}

function fromBodyParserError(error: unknown): ErrorBody | null {
  const type = (error as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') return { status: 400, message: 'Malformed JSON body' };
  if (type === 'entity.too.large') return { status: 413, message: 'Request body is too large' };
  return null;
}

function describeError(error: unknown): ErrorBody | null {
  if (error instanceof ApiError) {
    return { status: error.status, message: error.message, errors: error.errors };
  }
  if (error instanceof ZodError) {
    return {
      status: 422,
      message: 'Please correct the highlighted fields',
      errors: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  if (error instanceof MulterError) return fromMulterError(error);
  if (error instanceof Prisma.PrismaClientKnownRequestError) return fromPrismaError(error);
  return fromBodyParserError(error);
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const body = describeError(error);
  if (!body) {
    if (env.NODE_ENV !== 'test') console.error(error);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    return;
  }
  res.status(body.status).json({
    success: false,
    message: body.message,
    ...(body.errors ? { errors: body.errors } : {}),
  });
};
