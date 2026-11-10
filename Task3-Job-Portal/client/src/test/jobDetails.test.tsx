import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { JobDetailsPage } from '../pages/public/JobDetailsPage';
import type { JobDetails, Role } from '../types';

const baseJob: JobDetails = {
  id: 'job-1',
  title: 'React Developer',
  description: 'Build interfaces.',
  requirements: 'React.',
  responsibilities: 'Ship features.',
  location: 'Pune',
  jobType: 'FULL_TIME',
  workMode: 'REMOTE',
  experienceLevel: 'MID',
  salaryMin: 100000,
  salaryMax: 200000,
  status: 'ACTIVE',
  publishedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2030-02-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  company: {
    id: 'c1',
    name: 'Cedar Studio',
    website: null,
    industry: null,
    size: null,
    location: null,
    description: null,
  },
  skills: ['React'],
  applicationsOpen: true,
  canManage: false,
  viewerApplication: null,
};

function setup(job: JobDetails, role: Role | null, onApply?: () => [number, unknown]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      let result: [number, unknown];
      if (url.endsWith('/auth/me')) {
        result = role
          ? [200, { data: { id: 'u', email: 'a@example.com', name: 'A', role, isActive: true } }]
          : [401, { message: 'Authentication required' }];
      } else if (url.endsWith('/job-seekers/me/resume')) {
        result = [200, { data: { id: 'r', originalName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 10, createdAt: '' } }];
      } else if (url.endsWith('/applications') && init?.method === 'POST') {
        result = onApply ? onApply() : [201, { data: { id: 'a1' } }];
      } else {
        result = [200, { data: job }];
      }
      return new Response(JSON.stringify(result[1]), { status: result[0] });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/jobs/job-1']}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/jobs/:id" element={<JobDetailsPage />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('job details apply panel', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('shows all key job information', async () => {
    setup(baseJob, null);
    expect(await screen.findByRole('heading', { name: 'React Developer' })).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(screen.getByText('Mid level')).toBeInTheDocument();
    expect(screen.getByText('Application deadline')).toBeInTheDocument();
  });

  it('asks anonymous visitors to sign in', async () => {
    setup(baseJob, null);
    expect(await screen.findByRole('link', { name: 'Sign in to apply' })).toBeInTheDocument();
  });

  it('offers Apply Now to a job seeker and submits', async () => {
    const apply = vi.fn((): [number, unknown] => [201, { data: { id: 'a1' } }]);
    setup(baseJob, 'JOB_SEEKER', apply);
    await userEvent.click(await screen.findByRole('button', { name: 'Apply Now' }));
    const submit = await screen.findByRole('button', { name: 'Submit application' });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await waitFor(() => expect(apply).toHaveBeenCalledOnce());
    expect(await screen.findByText('Your application has been submitted.')).toBeInTheDocument();
  });

  it('shows Already Applied when an application exists', async () => {
    setup({ ...baseJob, viewerApplication: { id: 'a1', status: 'INTERVIEW' } }, 'JOB_SEEKER');
    expect(await screen.findByRole('button', { name: 'Already Applied' })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Interview/ })).toBeInTheDocument();
  });

  it('shows Applications Closed when the job is not open', async () => {
    setup({ ...baseJob, status: 'CLOSED', applicationsOpen: false }, 'JOB_SEEKER');
    expect(await screen.findByRole('button', { name: 'Applications Closed' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
  });

  it('does not offer applying to employers', async () => {
    setup(baseJob, 'EMPLOYER');
    expect(await screen.findByText('Only job seeker accounts can apply.')).toBeInTheDocument();
  });

  it('surfaces a server rejection in the dialog flow', async () => {
    setup(baseJob, 'JOB_SEEKER', () => [409, { message: 'You have already applied to this job' }]);
    await userEvent.click(await screen.findByRole('button', { name: 'Apply Now' }));
    const submit = await screen.findByRole('button', { name: 'Submit application' });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    expect(await screen.findByText('You have already applied to this job')).toBeInTheDocument();
  });
});
