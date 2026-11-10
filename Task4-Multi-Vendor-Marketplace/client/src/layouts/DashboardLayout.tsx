import type { LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { Brand, SessionControls } from './StoreLayout';

export interface DashboardLink {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export function DashboardLayout({ title, links }: { title: string; links: DashboardLink[] }) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-inner">
          <div className="dashboard-brand">
            <Brand />
            <span className="dashboard-title">{title}</span>
          </div>
          <nav aria-label={`${title} navigation`}>
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}>
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
      <div className="dashboard-content">
        <div className="dashboard-topbar">
          <NavLink to="/products">View marketplace</NavLink>
          <SessionControls />
        </div>
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
