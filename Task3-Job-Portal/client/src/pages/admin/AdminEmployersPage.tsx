import { useCallback, useState } from 'react';
import { adminApi } from '../../api';
import { ConfirmDialog } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { AsyncView, EmptyState, PageHeader, Pagination } from '../../components/ui';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import { formatDate } from '../../lib/format';
import type { AdminEmployer } from '../../types';

export function AdminEmployersPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const state = useAsync(useCallback(() => adminApi.employers({ q, page, limit: 15 }), [q, page]));
  const { run } = useAction();
  const [target, setTarget] = useState<AdminEmployer | null>(null);

  return (
    <>
      <PageHeader title="Employers" subtitle="Jobs from a deactivated employer are hidden from listings." />
      <div className="toolbar">
        <SearchBox
          placeholder="Search employer or company"
          onSearch={(value) => {
            setQ(value);
            setPage(1);
          }}
        />
      </div>
      <AsyncView state={state}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState title="No employers found" />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employer</th>
                      <th>Company</th>
                      <th>Industry</th>
                      <th>Jobs</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((employer) => (
                      <tr key={employer.id}>
                        <td>
                          {employer.user.name}
                          <div className="cell-sub">{employer.user.email}</div>
                        </td>
                        <td>{employer.company?.name ?? 'Not created'}</td>
                        <td>{employer.company?.industry ?? '—'}</td>
                        <td>{employer.company?.jobCount ?? 0}</td>
                        <td>
                          <span className={`badge ${employer.user.isActive ? 'job-active' : 'job-closed'}`}>
                            {employer.user.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td>{formatDate(employer.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className={`link-btn ${employer.user.isActive ? 'danger' : ''}`}
                            onClick={() => setTarget(employer)}
                          >
                            {employer.user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
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
      {target && (
        <ConfirmDialog
          title={target.user.isActive ? 'Deactivate employer' : 'Activate employer'}
          message={
            target.user.isActive
              ? `Deactivate ${target.user.name}? Their jobs will be hidden from listings.`
              : `Restore access for ${target.user.name}?`
          }
          confirmLabel={target.user.isActive ? 'Deactivate' : 'Activate'}
          danger={target.user.isActive}
          onClose={() => setTarget(null)}
          onConfirm={async () => {
            const done = await run(
              () => adminApi.setUserActive(target.user.id, !target.user.isActive),
              'Employer updated.',
            );
            if (done) await state.reload();
          }}
        />
      )}
    </>
  );
}
