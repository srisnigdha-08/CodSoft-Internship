import { z } from 'zod';
import { newPassword } from './auth.validation.js';
import { dateOnly, optionalText, phoneField, requiredText, skillNames } from './common.js';

export const updateAccountSchema = z.object({ name: requiredText('Name', 2, 120) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newPassword,
});

export const jobSeekerProfileSchema = z.object({
  name: requiredText('Full name', 2, 120),
  phone: phoneField,
  location: optionalText(120),
  headline: optionalText(160),
  summary: optionalText(5000),
});

export const skillsSchema = z.object({ skills: skillNames });

export const educationSchema = z
  .object({
    institution: requiredText('Institution', 2, 160),
    degree: requiredText('Degree', 2, 120),
    fieldOfStudy: requiredText('Field of study', 2, 120),
    startDate: dateOnly,
    endDate: dateOnly.nullable().optional(),
    grade: optionalText(40),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End date cannot be before start date',
  });

export const experienceSchema = z
  .object({
    company: requiredText('Company', 2, 160),
    jobTitle: requiredText('Job title', 2, 120),
    description: optionalText(5000),
    startDate: dateOnly,
    endDate: dateOnly.nullable().optional(),
    currentlyWorking: z.boolean().default(false),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End date cannot be before start date',
  })
  .refine((value) => value.currentlyWorking || Boolean(value.endDate), {
    path: ['endDate'],
    message: 'End date is required unless you currently work here',
  })
  .transform((value) => ({
    ...value,
    endDate: value.currentlyWorking ? null : value.endDate,
  }));

export const employerProfileSchema = z.object({
  name: requiredText('Full name', 2, 120),
  phone: phoneField,
  position: optionalText(120),
});

export const companySchema = z.object({
  name: requiredText('Company name', 2, 160),
  website: z
    .union([z.literal(''), z.url({ protocol: /^https?$/, error: 'Enter a valid http(s) URL' })])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  industry: optionalText(120),
  size: optionalText(40),
  location: optionalText(120),
  description: optionalText(5000),
});

export type JobSeekerProfileInput = z.infer<typeof jobSeekerProfileSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type EmployerProfileInput = z.infer<typeof employerProfileSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
