import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { employerApi, jobsApi } from '../../api';
import { ConfirmDialog } from '../../components/Modal';
import { AsyncView, EmptyState, JobStatusBadge, PageHeader, Pagination } from '../../components/ui';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, JOB_STATUS_LABELS, options } from '../../lib/format';
import type { ManagedJob } from '../../types';

type Pending =
  | { kind: 'close'; job: ManagedJob }
  | { kind: 'delete'; job: ManagedJob }
  | null;

export function EmployerJobsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const state = useAsync(
    useCallback(() => employerApi.jobs({ status, page, limit: 10 }), [status, page]),
  );
  const { busy, run } = useAction();
  const [pending, setPending] = useState<Pending>(null);

  const change = async (job: ManagedJob, next: 'ACTIVE' | 'DRAFT', message: string) => {
    if (await run(() => jobsApi.setStatus(job.id, next), message)) await state.reload();
  };

  return (
    <>
      <PageHeader
        title="Manage Jobs"
        actions={
          <Link to="/employer/jobs/new" className="btn btn-primary">
            Post New Job
          </Link>
        }
      />
      <div className="toolbar">
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
            {options(JOB_STATUS_LABELS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <AsyncView state={state}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState
              title="No jobs here yet"
              action={
                <Link to="/employer/jobs/new" className="btn btn-secondary">
                  Post your first job
                </Link>
              }
            />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Status</th>
                      <th>Applicants</th>
                      <th>Posted</th>
                      <th>Deadline</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((job) => (
                      <tr key={job.id}>
                        <td>
                          <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                          <div className="cell-sub">{job.location}</div>
                          {job.moderatedAt && (
                            <div className="cell-warn">
                              Deactivated by admin: {job.moderationReason}
                            </div>
                          )}
                        </td>
                        <td>
                          <JobStatusBadge status={job.status} />
                        </td>
                        <td>
                          <Link to={`/employer/jobs/${job.id}/applicants`}>
                            {job.applicationCount}{' '}
                            {job.applicationCount === 1 ? 'applicant' : 'applicants'}
                          </Link>
                        </td>
                        <td>{formatDate(job.publishedAt)}</td>
                        <td>{job.expiresAt ? formatDate(job.expiresAt) : '—'}</td>
                        <td>
                          <div className="row-actions wrap">
                            <Link to={`/employer/jobs/${job.id}/edit`}>Edit</Link>
                            {!job.moderatedAt && job.status !== 'ACTIVE' && (
                              <button
                                type="button"
                                className="link-btn"
                                disabled={busy}
                                onClick={() => void change(job, 'ACTIVE', 'Job activated.')}
                              >
                                Activate
                              </button>
                            )}
                            {!job.moderatedAt && job.status === 'ACTIVE' && (
                              <button
                                type="button"
                                className="link-btn"
                                disabled={busy}
                                onClick={() => void change(job, 'DRAFT', 'Job deactivated.')}
                              >
                                Deactivate
                              </button>
                            )}
                            {!job.moderatedAt && job.status !== 'CLOSED' && (
                              <button type="button" className="link-btn" onClick={() => setPending({ kind: 'close', job })}>
                                Close
                              </button>
                            )}
                            {job.applicationCount === 0 && (
                              <button type="button" className="link-btn danger" onClick={() => setPending({ kind: 'delete', job })}>
                                Delete
                              </button>
                            )}
                          </div>
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
      {pending?.kind === 'close' && (
        <ConfirmDialog
          title="Close job"
          message={`Close "${pending.job.title}"? It will stop accepting applications.`}
          confirmLabel="Close job"
          onClose={() => setPending(null)}
          onConfirm={async () => {
            if (await run(() => jobsApi.setStatus(pending.job.id, 'CLOSED'), 'Job closed.')) {
              await state.reload();
            }
          }}
        />
      )}
      {pending?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete job"
          message={`Permanently delete "${pending.job.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setPending(null)}
          onConfirm={async () => {
            if (await run(() => jobsApi.remove(pending.job.id), 'Job deleted.')) {
              await state.reload();
            }
          }}
        />
      )}
    </>
  );
}
