import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { LoginPage } from '../pages/public/LoginPage';
import { RegisterPage } from '../pages/public/RegisterPage';
import type { Role, User } from '../types';

const userWith = (role: Role): User => ({
  id: 'u1',
  email: 'person@example.com',
  name: 'Person',
  role,
  isActive: true,
});

type Handler = (url: string, init?: RequestInit) => [number, unknown];

function stubApi(handler: Handler) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const [status, body] = handler(url, init);
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

const signedOut = (): [number, unknown] => [401, { success: false, message: 'Authentication required' }];

function renderApp(initial: string, extra: React.ReactNode = null) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <p>Admin area</p>
                </ProtectedRoute>
              }
            />
            <Route path="/job-seeker/dashboard" element={<p>Seeker home</p>} />
            <Route path="/employer/dashboard" element={<p>Employer home</p>} />
            {extra}
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('protected routes', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('sends anonymous visitors to sign in', async () => {
    stubApi(signedOut);
    renderApp('/admin/dashboard');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });

  it('sends the wrong role to its own dashboard', async () => {
    stubApi(() => [200, { success: true, data: userWith('JOB_SEEKER') }]);
    renderApp('/admin/dashboard');
    expect(await screen.findByText('Seeker home')).toBeInTheDocument();
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });

  it('lets the correct role in', async () => {
    stubApi(() => [200, { success: true, data: userWith('ADMIN') }]);
    renderApp('/admin/dashboard');
    expect(await screen.findByText('Admin area')).toBeInTheDocument();
  });
});

describe('authentication forms', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('signs in and goes to the dashboard for the role', async () => {
    stubApi((url) =>
      url.endsWith('/auth/login')
        ? [200, { success: true, data: userWith('EMPLOYER') }]
        : signedOut(),
    );
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'person@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Employer home')).toBeInTheDocument();
  });

  it('shows the server message when sign-in fails and stays on the form', async () => {
    stubApi((url) =>
      url.endsWith('/auth/login')
        ? [401, { success: false, message: 'Invalid email or password' }]
        : signedOut(),
    );
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'person@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Wrong1234');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('never writes the session to browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    stubApi((url) =>
      url.endsWith('/auth/login')
        ? [200, { success: true, data: userWith('EMPLOYER') }]
        : signedOut(),
    );
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'person@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Employer home');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('shows field errors returned by registration', async () => {
    stubApi((url) =>
      url.endsWith('/auth/register')
        ? [
            422,
            {
              success: false,
              message: 'Please correct the highlighted fields',
              errors: [{ field: 'password', message: 'Password must be at least 8 characters' }],
            },
          ]
        : signedOut(),
    );
    renderApp('/register?role=EMPLOYER');
    await userEvent.type(await screen.findByLabelText('Full name'), 'New Person');
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('I am hiring')).toBeChecked());
  });
});
