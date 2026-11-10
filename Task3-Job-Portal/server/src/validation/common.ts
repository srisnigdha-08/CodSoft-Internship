import { z } from 'zod';

export const idParams = z.object({ id: z.uuid('Invalid identifier') });

export const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};

/** Optional text where an empty string means "clear this value". */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const phoneField = z
  .string()
  .trim()
  .regex(/^$|^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

/** Calendar date in YYYY-MM-DD form, stored at midnight UTC. */
export const dateOnly = z.iso
  .date('Enter a valid date')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const skillNames = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[\p{L}\p{N}+#./\- ]+$/u, 'Skill names contain unsupported characters'),
  )
  .max(30, 'Add at most 30 skills');
