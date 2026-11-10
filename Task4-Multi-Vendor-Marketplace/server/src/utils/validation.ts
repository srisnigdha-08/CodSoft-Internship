import { Types } from 'mongoose';
import { z } from 'zod';
import { badRequest } from './AppError.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

export const objectIdString = z.string().regex(OBJECT_ID, 'Must be a valid id');

/** Validates a route parameter id, responding 400 when malformed. */
export function parseId(value: unknown, label = 'id'): Types.ObjectId {
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) throw badRequest(`Invalid ${label}`);
  return new Types.ObjectId(value);
}

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const addressSchema = z.object({
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  postalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,12}$/, 'Invalid postal code'),
  country: z.string().trim().min(2).max(60).default('India'),
});

export const phoneSchema = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Invalid phone number');

/** Accepts absolute http(s) URLs and root-relative paths such as /catalog/item.svg. */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^(https?:\/\/[^\s]+|\/[^\s/][^\s]*)$/, 'Must be an http(s) URL or a root-relative path');
