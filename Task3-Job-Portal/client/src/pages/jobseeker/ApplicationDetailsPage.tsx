import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applicationResumeUrl, applicationsApi } from '../../api';
import { ConfirmDialog } from '../../components/Modal';
import { StatusTimeline } from '../../components/StatusTimeline';
import { ApplicationBadge, AsyncView, PageHeader } from '../../components/ui';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import { formatDate, JOB_TYPE_LABELS, WORK_MODE_LABELS } from '../../lib/format';

export function ApplicationDetailsPage() {
  const { id = '' } = useParams();
  const state = useAsync(useCallback(() => applicationsApi.details(id), [id]));
  const { run } = useAction();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Link to="/job-seeker/applications" className="back-link">
        ← My Applications
      </Link>
      <AsyncView state={state}>
        {(application) => (
          <>
            <PageHeader
              title={application.job.title}
              subtitle={`${application.job.company.name} · ${application.job.location}`}
              actions={
                application.canWithdraw && (
                  <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
                    Withdraw
                  </button>
                )
              }
            />
            <div className="two-col">
              <div className="stack">
                <section className="card">
                  <h2>Summary</h2>
                  <dl className="facts">
                    <dt>Status</dt>
                    <dd>
                      <ApplicationBadge status={application.status} />
                    </dd>
                    <dt>Applied</dt>
                    <dd>{formatDate(application.createdAt)}</dd>
                    <dt>Last updated</dt>
                    <dd>{formatDate(application.updatedAt)}</dd>
                    <dt>Job type</dt>
                    <dd>{JOB_TYPE_LABELS[application.job.jobType]}</dd>
                    <dt>Work mode</dt>
                    <dd>{WORK_MODE_LABELS[application.job.workMode]}</dd>
                    <dt>Resume sent</dt>
                    <dd>
                      {application.resume ? (
                        <a href={applicationResumeUrl(application.id)}>
                          {application.resume.originalName}
                        </a>
                      ) : (
                        'None'
                      )}
                    </dd>
                  </dl>
                </section>
                <section className="card">
                  <h2>Cover letter</h2>
                  <p className="preserve-lines">
                    {application.coverLetter || 'No cover letter was included.'}
                  </p>
                </section>
              </div>
              <section className="card">
                <h2>Status history</h2>
                <StatusTimeline history={application.history} />
              </section>
            </div>
            {confirming && (
              <ConfirmDialog
                title="Withdraw application"
                message="Withdraw this application? This cannot be undone."
                confirmLabel="Withdraw"
                danger
                onClose={() => setConfirming(false)}
                onConfirm={async () => {
                  const done = await run(
                    () => applicationsApi.withdraw(application.id),
                    'Application withdrawn.',
                  );
                  if (done) await state.reload();
                }}
              />
            )}
          </>
        )}
      </AsyncView>
    </>
  );
}
