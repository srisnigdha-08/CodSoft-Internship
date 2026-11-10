import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

const LINKS: Record<Role, { to: string; label: string }[]> = {
  JOB_SEEKER: [
    { to: '/job-seeker/dashboard', label: 'Dashboard' },
    { to: '/job-seeker/profile', label: 'Profile' },
    { to: '/job-seeker/resume', label: 'Resume' },
    { to: '/jobs', label: 'Browse Jobs' },
    { to: '/job-seeker/applications', label: 'My Applications' },
  ],
  EMPLOYER: [
    { to: '/employer/dashboard', label: 'Dashboard' },
    { to: '/employer/company', label: 'Company Profile' },
    { to: '/employer/jobs', label: 'Manage Jobs' },
    { to: '/employer/jobs/new', label: 'Post New Job' },
  ],
  ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/employers', label: 'Employers' },
    { to: '/admin/jobs', label: 'Jobs' },
    { to: '/admin/applications', label: 'Applications' },
  ],
};

export function DashboardLayout() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <nav aria-label="Dashboard">
          {LINKS[user.role].map((link) => (
            <NavLink key={link.to} to={link.to} end>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}
