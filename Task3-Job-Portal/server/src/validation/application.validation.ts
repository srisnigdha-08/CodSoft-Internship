import { ApplicationStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { optionalText, paginationFields } from './common.js';

// candidateId and userId are intentionally not accepted: identity comes from the session.
export const createApplicationSchema = z.object({
  jobId: z.uuid('Invalid job identifier'),
  coverLetter: optionalText(5000),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(ApplicationStatus, { error: 'Choose a valid status' }),
});

export const applicationListSchema = z.object({
  ...paginationFields,
  status: z.enum(ApplicationStatus).optional(),
});

export const adminApplicationListSchema = applicationListSchema.extend({
  q: z.string().trim().max(120).optional(),
});

const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export const adminUserListSchema = z.object({
  ...paginationFields,
  q: z.string().trim().max(120).optional(),
  role: z.enum(Role).optional(),
  isActive: booleanQuery.optional(),
});

export const adminEmployerListSchema = z.object({
  ...paginationFields,
  q: z.string().trim().max(120).optional(),
});

export const userStatusSchema = z.object({
  isActive: z.boolean({ error: 'isActive must be true or false' }),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type ApplicationListQuery = z.infer<typeof applicationListSchema>;
export type AdminApplicationListQuery = z.infer<typeof adminApplicationListSchema>;
export type AdminUserListQuery = z.infer<typeof adminUserListSchema>;
export type AdminEmployerListQuery = z.infer<typeof adminEmployerListSchema>;
