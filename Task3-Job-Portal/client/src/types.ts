export type Role = 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';
export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
export type WorkMode = 'ONSITE' | 'REMOTE' | 'HYBRID';
export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD';
export type JobStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'EXPIRED';
export type ApplicationStatus =
  | 'APPLIED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'INTERVIEW'
  | 'REJECTED'
  | 'HIRED'
  | 'WITHDRAWN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export interface Company {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  description: string | null;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  location: string;
  jobType: JobType;
  workMode: WorkMode;
  experienceLevel: ExperienceLevel;
  salaryMin: number | null;
  salaryMax: number | null;
  status: JobStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: Company;
  skills: string[];
  applicationsOpen: boolean;
}

export interface ManagedJob extends Job {
  applicationCount: number;
  moderatedAt: string | null;
  moderationReason: string | null;
}

export interface JobDetails extends Job {
  canManage: boolean;
  viewerApplication: { id: string; status: ApplicationStatus } | null;
}

export interface JobSearchParams {
  q?: string;
  location?: string;
  jobType?: string;
  workMode?: string;
  experienceLevel?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface JobInput {
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  location: string;
  jobType: JobType;
  workMode: WorkMode;
  experienceLevel: ExperienceLevel;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string[];
  expiresAt: string | null;
  status?: 'DRAFT' | 'ACTIVE';
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string | null;
  grade: string | null;
}

export interface Experience {
  id: string;
  company: string;
  jobTitle: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  currentlyWorking: boolean;
}

export interface Resume {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface SeekerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  skills: string[];
  education: Education[];
  experience: Experience[];
  resume: Resume | null;
}

export type EducationInput = Omit<Education, 'id'>;
export type ExperienceInput = Omit<Experience, 'id'>;

export interface RecentSeekerApplication {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  job: { id: string; title: string; company: { name: string } };
}

export interface SeekerDashboard {
  totalApplications: number;
  byStatus: Record<ApplicationStatus, number>;
  recentApplications: RecentSeekerApplication[];
  profileChecklist: Record<string, boolean>;
  profileCompletion: number;
}

export interface OwnApplication {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  canWithdraw: boolean;
  job: { id: string; title: string; location: string; company: { name: string } };
}

export interface StatusHistoryEntry {
  id: string;
  previousStatus: ApplicationStatus | null;
  newStatus: ApplicationStatus;
  timestamp: string;
  changedBy: { name: string; role: Role };
}

export interface CandidateDetails {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  skills: string[];
  education: Education[];
  experience: Experience[];
}

export interface ApplicationDetails {
  id: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  createdAt: string;
  updatedAt: string;
  canWithdraw: boolean;
  allowedNextStatuses: ApplicationStatus[];
  resume: Resume | null;
  history: StatusHistoryEntry[];
  candidate: CandidateDetails | null;
  job: {
    id: string;
    title: string;
    location: string;
    jobType: JobType;
    workMode: WorkMode;
    status: JobStatus;
    company: { id: string; name: string };
  };
}

export interface Applicant {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  hasResume: boolean;
  candidate: {
    name: string;
    headline: string | null;
    skills: string[];
    experienceYears: number;
    latestRole: string | null;
  };
}

export interface ApplicantPage extends Page<Applicant> {
  job: { id: string; title: string };
}

export interface EmployerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  company: Company | null;
}

export interface EmployerDashboard {
  hasCompany: boolean;
  totalJobs: number;
  activeJobs: number;
  closedJobs: number;
  totalApplications: number;
  pendingReview: number;
  shortlisted: number;
  recentApplications: {
    id: string;
    status: ApplicationStatus;
    createdAt: string;
    candidateName: string;
    job: { id: string; title: string };
  }[];
}

export interface PlatformStats {
  totalUsers: number;
  totalJobSeekers: number;
  totalEmployers: number;
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  applicationsByStatus: Record<ApplicationStatus, number>;
}

export interface AdminEmployer {
  id: string;
  position: string | null;
  phone: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; isActive: boolean };
  company: {
    id: string;
    name: string;
    industry: string | null;
    location: string | null;
    jobCount: number;
  } | null;
}

export interface AdminApplication {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  job: { id: string; title: string; company: { name: string } };
  candidate: { name: string; email: string };
}
