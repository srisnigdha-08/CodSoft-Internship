import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { seekerApi } from '../../api';
import {
  ApplicationBadge,
  AsyncView,
  EmptyState,
  PageHeader,
  StatCard,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { formatDate } from '../../lib/format';

const CHECKLIST_LABELS: Record<string, string> = {
  headline: 'Headline',
  summary: 'Professional summary',
  location: 'Location',
  phone: 'Phone number',
  skills: 'Skills',
  education: 'Education',
  experience: 'Experience',
  resume: 'Resume',
};

export function SeekerDashboardPage() {
  const { user } = useAuth();
  const state = useAsync(useCallback(() => seekerApi.dashboard(), []));

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.name.split(' ')[0]}`}
        subtitle="Here is where your job search stands."
        actions={
          <Link to="/jobs" className="btn btn-primary">
            Browse jobs
          </Link>
        }
      />
      <AsyncView state={state}>
        {(data) => (
          <>
            <div className="stat-grid">
              <StatCard label="Total applications" value={data.totalApplications} tone="ink" />
              <StatCard label="Under review" value={data.byStatus.UNDER_REVIEW} />
              <StatCard label="Shortlisted" value={data.byStatus.SHORTLISTED} tone="sea" />
              <StatCard label="Interviews" value={data.byStatus.INTERVIEW} tone="amber" />
            </div>
            <div className="two-col">
              <section className="card">
                <div className="section-head">
                  <h2>Recent applications</h2>
                  <Link to="/job-seeker/applications">View all →</Link>
                </div>
                {data.recentApplications.length === 0 ? (
                  <EmptyState
                    title="No applications yet"
                    message="Jobs you apply to will be tracked here."
                    action={
                      <Link to="/jobs" className="btn btn-secondary">
                        Find a job
                      </Link>
                    }
                  />
                ) : (
                  <ul className="row-list">
                    {data.recentApplications.map((application) => (
                      <li key={application.id}>
                        <div>
                          <Link to={`/job-seeker/applications/${application.id}`}>
                            {application.job.title}
                          </Link>
                          <span>
                            {application.job.company.name} · Updated{' '}
                            {formatDate(application.updatedAt)}
                          </span>
                        </div>
                        <ApplicationBadge status={application.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="card">
                <h2>Profile {data.profileCompletion}% complete</h2>
                <div className="progress" aria-hidden="true">
                  <span style={{ width: `${data.profileCompletion}%` }} />
                </div>
                <ul className="checklist">
                  {Object.entries(data.profileChecklist).map(([key, done]) => (
                    <li key={key} className={done ? 'done' : ''}>
                      {CHECKLIST_LABELS[key] ?? key}
                    </li>
                  ))}
                </ul>
                <Link to="/job-seeker/profile" className="btn btn-secondary btn-block">
                  Update profile
                </Link>
              </section>
            </div>
          </>
        )}
      </AsyncView>
    </>
  );
}
