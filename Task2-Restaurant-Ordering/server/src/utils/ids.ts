import { z } from 'zod';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

export const objectIdSchema = (message = 'Invalid ID') => z.string().regex(OBJECT_ID_PATTERN, message);

/** Filter for a record addressed either by its id or by a human-readable field. */
export function idOrField(value: string, field: string): Record<string, unknown> {
  return isObjectIdString(value) ? { $or: [{ _id: value }, { [field]: value }] } : { [field]: value };
}

/** Escapes user text before it is used inside a regular expression. */
export function containsInsensitive(term: string) {
  return { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
}
