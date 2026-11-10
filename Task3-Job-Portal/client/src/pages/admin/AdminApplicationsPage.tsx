import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { SearchBox } from '../../components/SearchBox';
import { ApplicationBadge, AsyncView, EmptyState, PageHeader, Pagination } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES, formatDate } from '../../lib/format';

export function AdminApplicationsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const state = useAsync(
    useCallback(() => adminApi.applications({ q, status, page, limit: 15 }), [q, status, page]),
  );

  return (
    <>
      <PageHeader title="Applications" subtitle="Every application on the platform." />
      <div className="toolbar">
        <SearchBox
          placeholder="Search job, company or candidate"
          onSearch={(value) => {
            setQ(value);
            setPage(1);
          }}
        />
        <label className="sort">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {APPLICATION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <AsyncView state={state}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState title="No applications found" />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Job</th>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Applied</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((application) => (
                      <tr key={application.id}>
                        <td>
                          {application.candidate.name}
                          <div className="cell-sub">{application.candidate.email}</div>
                        </td>
                        <td>{application.job.title}</td>
                        <td>{application.job.company.name}</td>
                        <td>
                          <ApplicationBadge status={application.status} />
                        </td>
                        <td>{formatDate(application.createdAt)}</td>
                        <td>
                          <Link to={`/admin/applications/${application.id}`}>View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={result.meta} onChange={setPage} />
            </>
          )
        }
      </AsyncView>
    </>
  );
}
