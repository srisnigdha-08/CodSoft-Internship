import type {
  AdminApplication,
  AdminEmployer,
  Applicant,
  ApplicantPage,
  ApplicationDetails,
  ApplicationStatus,
  Company,
  Education,
  EducationInput,
  EmployerDashboard,
  EmployerProfile,
  Experience,
  ExperienceInput,
  Job,
  JobDetails,
  JobInput,
  JobSearchParams,
  ManagedJob,
  OwnApplication,
  PlatformStats,
  Resume,
  Role,
  SeekerDashboard,
  SeekerProfile,
  User,
} from '../types';
import { http } from './client';

export const authApi = {
  me: () => http.get<User>('/auth/me'),
  login: (email: string, password: string) => http.post<User>('/auth/login', { email, password }),
  register: (input: { name: string; email: string; password: string; role: Role }) =>
    http.post<User>('/auth/register', input),
  logout: () => http.post<void>('/auth/logout'),
};

export const jobsApi = {
  search: (params: JobSearchParams) => http.page<Job>('/jobs', params),
  filters: () => http.get<{ locations: string[] }>('/jobs/filters'),
  details: (id: string) => http.get<JobDetails>(`/jobs/${id}`),
  create: (input: JobInput) => http.post<ManagedJob>('/jobs', input),
  update: (id: string, input: JobInput) => http.put<ManagedJob>(`/jobs/${id}`, input),
  setStatus: (id: string, status: 'DRAFT' | 'ACTIVE' | 'CLOSED') =>
    http.patch<ManagedJob>(`/jobs/${id}/status`, { status }),
  remove: (id: string) => http.delete(`/jobs/${id}`),
  applicants: (id: string, params: { status?: string; page?: number; limit?: number }) =>
    http.pageWith<Applicant, ApplicantPage['job']>(`/jobs/${id}/applications`, 'job', params),
};

export const seekerApi = {
  profile: () => http.get<SeekerProfile>('/job-seekers/me'),
  dashboard: () => http.get<SeekerDashboard>('/job-seekers/me/dashboard'),
  updateProfile: (input: {
    name: string;
    phone: string;
    location: string;
    headline: string;
    summary: string;
  }) => http.put<SeekerProfile>('/job-seekers/me', input),
  setSkills: (skills: string[]) => http.put<SeekerProfile>('/job-seekers/me/skills', { skills }),
  addEducation: (input: EducationInput) => http.post<Education>('/job-seekers/me/education', input),
  updateEducation: (id: string, input: EducationInput) =>
    http.put<Education>(`/job-seekers/me/education/${id}`, input),
  deleteEducation: (id: string) => http.delete(`/job-seekers/me/education/${id}`),
  addExperience: (input: ExperienceInput) =>
    http.post<Experience>('/job-seekers/me/experience', input),
  updateExperience: (id: string, input: ExperienceInput) =>
    http.put<Experience>(`/job-seekers/me/experience/${id}`, input),
  deleteExperience: (id: string) => http.delete(`/job-seekers/me/experience/${id}`),
  resume: () => http.get<Resume | null>('/job-seekers/me/resume'),
  uploadResume: (file: File) => {
    const form = new FormData();
    form.append('resume', file);
    return http.upload<Resume>('/job-seekers/me/resume', form);
  },
  deleteResume: () => http.delete('/job-seekers/me/resume'),
};

export const OWN_RESUME_URL = '/api/job-seekers/me/resume/file';
export const applicationResumeUrl = (id: string) => `/api/applications/${id}/resume`;

export const applicationsApi = {
  apply: (jobId: string, coverLetter: string) =>
    http.post<{ id: string }>('/applications', { jobId, coverLetter }),
  listMine: (params: { status?: string; page?: number; limit?: number }) =>
    http.page<OwnApplication>('/applications', params),
  details: (id: string) => http.get<ApplicationDetails>(`/applications/${id}`),
  withdraw: (id: string) => http.post<ApplicationDetails>(`/applications/${id}/withdraw`),
  updateStatus: (id: string, status: ApplicationStatus) =>
    http.patch<ApplicationDetails>(`/applications/${id}/status`, { status }),
};

export const employerApi = {
  profile: () => http.get<EmployerProfile>('/employers/me'),
  updateProfile: (input: { name: string; phone: string; position: string }) =>
    http.put<EmployerProfile>('/employers/me', input),
  dashboard: () => http.get<EmployerDashboard>('/employers/me/dashboard'),
  jobs: (params: { q?: string; status?: string; page?: number; limit?: number }) =>
    http.page<ManagedJob>('/employers/me/jobs', params),
  saveCompany: (input: Omit<Company, 'id'>) => http.put<Company>('/companies/me', input),
};

interface AdminListParams {
  q?: string;
  page?: number;
  limit?: number;
}

export const adminApi = {
  stats: () => http.get<PlatformStats>('/admin/stats'),
  users: (params: AdminListParams & { role?: string; isActive?: string }) =>
    http.page<User>('/admin/users', params),
  setUserActive: (id: string, isActive: boolean) =>
    http.patch<User>(`/admin/users/${id}/status`, { isActive }),
  employers: (params: AdminListParams) => http.page<AdminEmployer>('/admin/employers', params),
  jobs: (params: AdminListParams & { status?: string }) =>
    http.page<ManagedJob>('/admin/jobs', params),
  moderateJob: (id: string, action: 'DEACTIVATE' | 'RESTORE', reason?: string) =>
    http.patch<ManagedJob>(`/admin/jobs/${id}/moderation`, { action, reason }),
  applications: (params: AdminListParams & { status?: string }) =>
    http.page<AdminApplication>('/admin/applications', params),
};
