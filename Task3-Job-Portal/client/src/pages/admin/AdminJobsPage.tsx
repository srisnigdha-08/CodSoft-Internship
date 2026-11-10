import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, jobsApi } from '../../api';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { SearchBox } from '../../components/SearchBox';
import { AsyncView, EmptyState, Field, JobStatusBadge, PageHeader, Pagination } from '../../components/ui';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, JOB_STATUS_LABELS, options } from '../../lib/format';
import type { ManagedJob } from '../../types';

function DeactivateDialog({
  job,
  onClose,
  onDone,
}: {
  job: ManagedJob;
  onClose: () => void;
  onDone: () => void;
}) {
  const { busy, errors, run } = useAction();
  const [reason, setReason] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const done = await run(
      () => adminApi.moderateJob(job.id, 'DEACTIVATE', reason),
      'Job deactivated.',
    );
    if (done) onDone();
  };

  return (
    <Modal title="Deactivate job" onClose={onClose}>
      <form onSubmit={(event) => void submit(event)}>
        <div className="modal-body">
          <p>
            “{job.title}” will be removed from listings, and the employer cannot republish it until
            you restore it.
          </p>
          <Field label="Reason (visible to the employer)" error={errors.reason}>
            <textarea rows={3} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            Deactivate
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function AdminJobsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const state = useAsync(
    useCallback(() => adminApi.jobs({ q, status, page, limit: 15 }), [q, status, page]),
  );
  const { run } = useAction();
  const [deactivating, setDeactivating] = useState<ManagedJob | null>(null);
  const [deleting, setDeleting] = useState<ManagedJob | null>(null);

  const restore = async (job: ManagedJob) => {
    if (await run(() => adminApi.moderateJob(job.id, 'RESTORE'), 'Job restored.')) {
      await state.reload();
    }
  };

  return (
    <>
      <PageHeader title="Jobs" subtitle="Moderate postings from every employer." />
      <div className="toolbar">
        <SearchBox
          placeholder="Search title or company"
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
            <EmptyState title="No jobs found" />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Applications</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((job) => (
                      <tr key={job.id}>
                        <td>
                          <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                          {job.moderatedAt && (
                            <div className="cell-warn">Moderated: {job.moderationReason}</div>
                          )}
                        </td>
                        <td>{job.company.name}</td>
                        <td>
                          <JobStatusBadge status={job.status} />
                        </td>
                        <td>{job.applicationCount}</td>
                        <td>{formatDate(job.createdAt)}</td>
                        <td>
                          <div className="row-actions wrap">
                            {job.moderatedAt ? (
                              <button type="button" className="link-btn" onClick={() => void restore(job)}>
                                Restore
                              </button>
                            ) : (
                              <button type="button" className="link-btn danger" onClick={() => setDeactivating(job)}>
                                Deactivate
                              </button>
                            )}
                            {job.applicationCount === 0 && (
                              <button type="button" className="link-btn danger" onClick={() => setDeleting(job)}>
                                Remove
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
      {deactivating && (
        <DeactivateDialog
          job={deactivating}
          onClose={() => setDeactivating(null)}
          onDone={() => {
            setDeactivating(null);
            void state.reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Remove job"
          message={`Permanently remove "${deleting.title}"? This cannot be undone.`}
          confirmLabel="Remove"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (await run(() => jobsApi.remove(deleting.id), 'Job removed.')) await state.reload();
          }}
        />
      )}
    </>
  );
}
