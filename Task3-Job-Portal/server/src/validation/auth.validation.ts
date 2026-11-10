import { z } from 'zod';
import { requiredText } from './common.js';

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254));

export const newPassword = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => Buffer.byteLength(value) <= 72, 'Password must be at most 72 bytes')
  .refine(
    (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value),
    'Password must include uppercase, lowercase and a number',
  );

// ADMIN is deliberately absent: administrator accounts cannot be self-registered.
export const registerSchema = z.object({
  name: requiredText('Name', 2, 120),
  email,
  password: newPassword,
  role: z.enum(['JOB_SEEKER', 'EMPLOYER'], { error: 'Choose job seeker or employer' }),
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
