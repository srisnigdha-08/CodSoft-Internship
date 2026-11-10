import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { employerApi } from '../../api';
import {
  ApplicationBadge,
  AsyncView,
  EmptyState,
  PageHeader,
  StatCard,
} from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { formatDate } from '../../lib/format';

export function EmployerDashboardPage() {
  const state = useAsync(useCallback(() => employerApi.dashboard(), []));

  return (
    <>
      <PageHeader
        title="Employer dashboard"
        subtitle="Your postings and hiring pipeline at a glance."
        actions={
          <>
            <Link to="/employer/company" className="btn btn-secondary">
              Company Profile
            </Link>
            <Link to="/employer/jobs" className="btn btn-secondary">
              Manage Jobs
            </Link>
            <Link to="/employer/jobs/new" className="btn btn-primary">
              Post New Job
            </Link>
          </>
        }
      />
      <AsyncView state={state}>
        {(data) => (
          <>
            {!data.hasCompany && (
              <p className="notice notice-warn">
                Create your <Link to="/employer/company">company profile</Link> before posting jobs.
              </p>
            )}
            <div className="stat-grid stat-grid-3">
              <StatCard label="Total Jobs" value={data.totalJobs} tone="ink" />
              <StatCard label="Active Jobs" value={data.activeJobs} tone="sea" />
              <StatCard label="Closed Jobs" value={data.closedJobs} />
              <StatCard label="Total Applications" value={data.totalApplications} tone="ink" />
              <StatCard label="Applications Pending Review" value={data.pendingReview} tone="amber" />
              <StatCard label="Shortlisted Candidates" value={data.shortlisted} tone="sea" />
            </div>
            <section className="card">
              <div className="section-head">
                <h2>Recent applicants</h2>
                <Link to="/employer/jobs">View Applicants →</Link>
              </div>
              {data.recentApplications.length === 0 ? (
                <EmptyState title="No applicants yet" message="New applications will show up here." />
              ) : (
                <ul className="row-list">
                  {data.recentApplications.map((application) => (
                    <li key={application.id}>
                      <div>
                        <Link to={`/employer/applicants/${application.id}`}>
                          {application.candidateName}
                        </Link>
                        <span>
                          {application.job.title} · Applied {formatDate(application.createdAt)}
                        </span>
                      </div>
                      <ApplicationBadge status={application.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </AsyncView>
    </>
  );
}
