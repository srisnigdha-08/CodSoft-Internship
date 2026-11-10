import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { applicationsApi } from '../../api';
import { ConfirmDialog } from '../../components/Modal';
import { ApplicationBadge, AsyncView, EmptyState, PageHeader, Pagination } from '../../components/ui';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES, formatDate } from '../../lib/format';
import type { OwnApplication } from '../../types';

export function MyApplicationsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(
    useCallback(() => applicationsApi.listMine({ status, page, limit: 10 }), [status, page]),
  );
  const { run } = useAction();
  const [withdrawing, setWithdrawing] = useState<OwnApplication | null>(null);

  const setStatus = (value: string) => setParams(value ? { status: value } : {});

  return (
    <>
      <PageHeader title="My Applications" subtitle="Follow each application as it moves forward." />
      <div className="tabs" role="tablist" aria-label="Filter by status">
        <button type="button" role="tab" aria-selected={!status} className={!status ? 'active' : ''} onClick={() => setStatus('')}>
          All
        </button>
        {APPLICATION_STATUSES.map((value) => (
          <button
            type="button"
            role="tab"
            key={value}
            aria-selected={status === value}
            className={status === value ? 'active' : ''}
            onClick={() => setStatus(value)}
          >
            {APPLICATION_STATUS_LABELS[value]}
          </button>
        ))}
      </div>
      <AsyncView state={state}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState
              title={status ? 'No applications with this status' : 'No applications yet'}
              action={
                <Link to="/jobs" className="btn btn-secondary">
                  Browse jobs
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
                      <th>Company</th>
                      <th>Applied</th>
                      <th>Status</th>
                      <th>Last updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((application) => (
                      <tr key={application.id}>
                        <td>
                          <Link to={`/jobs/${application.job.id}`}>{application.job.title}</Link>
                        </td>
                        <td>{application.job.company.name}</td>
                        <td>{formatDate(application.createdAt)}</td>
                        <td>
                          <ApplicationBadge status={application.status} />
                        </td>
                        <td>{formatDate(application.updatedAt)}</td>
                        <td>
                          <div className="row-actions">
                            <Link to={`/job-seeker/applications/${application.id}`}>Details</Link>
                            {application.canWithdraw && (
                              <button type="button" className="link-btn danger" onClick={() => setWithdrawing(application)}>
                                Withdraw
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                meta={result.meta}
                onChange={(next) =>
                  setParams({ ...(status ? { status } : {}), page: String(next) })
                }
              />
            </>
          )
        }
      </AsyncView>
      {withdrawing && (
        <ConfirmDialog
          title="Withdraw application"
          message={`Withdraw your application for ${withdrawing.job.title}? This cannot be undone.`}
          confirmLabel="Withdraw"
          danger
          onClose={() => setWithdrawing(null)}
          onConfirm={async () => {
            const done = await run(
              () => applicationsApi.withdraw(withdrawing.id),
              'Application withdrawn.',
            );
            if (done) await state.reload();
          }}
        />
      )}
    </>
  );
}
