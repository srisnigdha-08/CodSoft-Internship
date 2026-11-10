import { useCallback } from 'react';
import { adminApi } from '../../api';
import { ApplicationBadge, AsyncView, PageHeader, StatCard } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { APPLICATION_STATUSES } from '../../lib/format';

export function AdminDashboardPage() {
  const state = useAsync(useCallback(() => adminApi.stats(), []));

  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Platform activity across all accounts." />
      <AsyncView state={state}>
        {(stats) => (
          <>
            <div className="stat-grid stat-grid-3">
              <StatCard label="Total Users" value={stats.totalUsers} tone="ink" />
              <StatCard label="Total Job Seekers" value={stats.totalJobSeekers} />
              <StatCard label="Total Employers" value={stats.totalEmployers} />
              <StatCard label="Total Jobs" value={stats.totalJobs} tone="ink" />
              <StatCard label="Active Jobs" value={stats.activeJobs} tone="sea" />
              <StatCard label="Total Applications" value={stats.totalApplications} tone="amber" />
            </div>
            <section className="card">
              <h2>Applications by Status</h2>
              <div className="table-wrap flush">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Applications</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {APPLICATION_STATUSES.map((status) => {
                      const count = stats.applicationsByStatus[status];
                      const share = stats.totalApplications
                        ? Math.round((count / stats.totalApplications) * 100)
                        : 0;
                      return (
                        <tr key={status}>
                          <td>
                            <ApplicationBadge status={status} />
                          </td>
                          <td>{count}</td>
                          <td>{share}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </AsyncView>
    </>
  );
}
