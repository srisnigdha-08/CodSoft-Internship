import { ExperienceLevel, JobStatus, JobType, WorkMode } from '@prisma/client';
import { z } from 'zod';
import { optionalText, paginationFields, requiredText, skillNames } from './common.js';

const salary = z.number().int('Salary must be a whole number').min(0).max(100_000_000);

const jobFields = z.object({
  title: requiredText('Job title', 3, 160),
  description: requiredText('Description', 20, 10_000),
  requirements: requiredText('Requirements', 10, 10_000),
  responsibilities: requiredText('Responsibilities', 10, 10_000),
  location: requiredText('Location', 2, 120),
  jobType: z.enum(JobType, { error: 'Choose a valid job type' }),
  workMode: z.enum(WorkMode, { error: 'Choose a valid work mode' }),
  experienceLevel: z.enum(ExperienceLevel, { error: 'Choose a valid experience level' }),
  salaryMin: salary.nullable().optional(),
  salaryMax: salary.nullable().optional(),
  skills: skillNames.min(1, 'Add at least one skill'),
  expiresAt: z.iso
    .datetime({ offset: true, error: 'Enter a valid deadline' })
    .transform((value) => new Date(value))
    .nullable()
    .optional(),
});

const salaryRangeIsValid = (value: { salaryMin?: number | null; salaryMax?: number | null }) =>
  value.salaryMin == null || value.salaryMax == null || value.salaryMin <= value.salaryMax;

const salaryRangeIssue = {
  path: ['salaryMax'],
  message: 'Maximum salary must not be below minimum salary',
};

export const updateJobSchema = jobFields.refine(salaryRangeIsValid, salaryRangeIssue);

export const createJobSchema = jobFields
  .extend({ status: z.enum(['DRAFT', 'ACTIVE']).default('DRAFT') })
  .refine(salaryRangeIsValid, salaryRangeIssue);

export const jobStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED'], { error: 'Choose a valid job status' }),
});

export const jobSearchSchema = z.object({
  ...paginationFields,
  q: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  skill: z.string().trim().max(60).optional(),
  jobType: z.enum(JobType).optional(),
  workMode: z.enum(WorkMode).optional(),
  experienceLevel: z.enum(ExperienceLevel).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const managedJobsQuerySchema = z.object({
  ...paginationFields,
  q: z.string().trim().max(120).optional(),
  status: z.enum(JobStatus).optional(),
});

export const moderationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('DEACTIVATE'), reason: requiredText('Reason', 3, 500) }),
  z.object({ action: z.literal('RESTORE'), reason: optionalText(500) }),
]);

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobSearchQuery = z.infer<typeof jobSearchSchema>;
export type ManagedJobsQuery = z.infer<typeof managedJobsQuerySchema>;
export type ModerationInput = z.infer<typeof moderationSchema>;
