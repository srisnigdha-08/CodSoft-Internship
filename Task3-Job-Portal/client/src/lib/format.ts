import type {
  ApplicationStatus,
  ExperienceLevel,
  JobStatus,
  JobType,
  Role,
  WorkMode,
} from '../types';

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  FREELANCE: 'Freelance',
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ONSITE: 'On-site',
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  ENTRY: 'Entry level',
  MID: 'Mid level',
  SENIOR: 'Senior',
  LEAD: 'Lead',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  EXPIRED: 'Expired',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  REJECTED: 'Rejected',
  HIRED: 'Hired',
  WITHDRAWN: 'Withdrawn',
};

export const APPLICATION_STATUSES = Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[];

export const ROLE_LABELS: Record<Role, string> = {
  JOB_SEEKER: 'Job seeker',
  EMPLOYER: 'Employer',
  ADMIN: 'Admin',
};

export const ROLE_HOME: Record<Role, string> = {
  JOB_SEEKER: '/job-seeker/dashboard',
  EMPLOYER: '/employer/dashboard',
  ADMIN: '/admin/dashboard',
};

export const options = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return 'Present';
  return new Date(value).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatSalary(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'Not disclosed';
  if (min !== null && max !== null) return `${rupees.format(min)} – ${rupees.format(max)} / year`;
  if (min !== null) return `From ${rupees.format(min)} / year`;
  return `Up to ${rupees.format(max as number)} / year`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Converts a stored date to the YYYY-MM-DD value used by date inputs. */
export const toDateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');

/** A deadline chosen as a date stays open until the end of that local day. */
export const deadlineToIso = (dateValue: string): string | null =>
  dateValue ? new Date(`${dateValue}T23:59:59`).toISOString() : null;

/** The local calendar day of a stored deadline, for showing it again in a date input. */
export function deadlineToDateInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
