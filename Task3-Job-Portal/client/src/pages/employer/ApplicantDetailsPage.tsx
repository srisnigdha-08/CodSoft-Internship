import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applicationResumeUrl, applicationsApi } from '../../api';
import { ConfirmDialog } from '../../components/Modal';
import { StatusTimeline } from '../../components/StatusTimeline';
import { ApplicationBadge, AsyncView, PageHeader, SkillTags } from '../../components/ui';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import { APPLICATION_STATUS_LABELS, formatDate, formatMonthYear } from '../../lib/format';
import type { ApplicationStatus } from '../../types';

const FINAL_STATUSES: ApplicationStatus[] = ['REJECTED', 'HIRED'];

export function ApplicantDetailsPage({ backTo }: { backTo: string }) {
  const { id = '' } = useParams();
  const state = useAsync(useCallback(() => applicationsApi.details(id), [id]));
  const { busy, run } = useAction();
  const [confirming, setConfirming] = useState<ApplicationStatus | null>(null);

  const moveTo = async (status: ApplicationStatus) => {
    const done = await run(
      () => applicationsApi.updateStatus(id, status),
      `Status changed to ${APPLICATION_STATUS_LABELS[status]}.`,
    );
    if (done) await state.reload();
  };

  const requestMove = (status: ApplicationStatus) => {
    if (FINAL_STATUSES.includes(status)) setConfirming(status);
    else void moveTo(status);
  };

  return (
    <>
      <Link to={backTo} className="back-link">
        ← Back
      </Link>
      <AsyncView state={state}>
        {(application) => {
          const candidate = application.candidate;
          if (!candidate) return null;
          return (
            <>
              <PageHeader
                title={candidate.name}
                subtitle={`Applied for ${application.job.title} on ${formatDate(application.createdAt)}`}
                actions={<ApplicationBadge status={application.status} />}
              />
              <div className="two-col">
                <div className="stack">
                  <section className="card">
                    <h2>Candidate</h2>
                    {candidate.headline && <p className="lead-line">{candidate.headline}</p>}
                    <dl className="facts">
                      <dt>Email</dt>
                      <dd>{candidate.email}</dd>
                      <dt>Phone</dt>
                      <dd>{candidate.phone ?? '—'}</dd>
                      <dt>Location</dt>
                      <dd>{candidate.location ?? '—'}</dd>
                    </dl>
                    {candidate.summary && <p className="preserve-lines">{candidate.summary}</p>}
                  </section>
                  <section className="card">
                    <h2>Skills</h2>
                    {candidate.skills.length ? <SkillTags skills={candidate.skills} /> : <p>None listed.</p>}
                  </section>
                  <section className="card">
                    <h2>Experience</h2>
                    {candidate.experience.length === 0 && <p>None listed.</p>}
                    <ul className="entry-list">
                      {candidate.experience.map((entry) => (
                        <li key={entry.id}>
                          <div>
                            <strong>{entry.jobTitle}</strong>
                            <span>{entry.company}</span>
                            <span>
                              {formatMonthYear(entry.startDate)} –{' '}
                              {entry.currentlyWorking ? 'Present' : formatMonthYear(entry.endDate)}
                            </span>
                            {entry.description && <p className="preserve-lines">{entry.description}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="card">
                    <h2>Education</h2>
                    {candidate.education.length === 0 && <p>None listed.</p>}
                    <ul className="entry-list">
                      {candidate.education.map((entry) => (
                        <li key={entry.id}>
                          <div>
                            <strong>
                              {entry.degree}, {entry.fieldOfStudy}
                            </strong>
                            <span>{entry.institution}</span>
                            <span>
                              {formatMonthYear(entry.startDate)} – {formatMonthYear(entry.endDate)}
                              {entry.grade ? ` · ${entry.grade}` : ''}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="card">
                    <h2>Cover letter</h2>
                    <p className="preserve-lines">
                      {application.coverLetter || 'No cover letter was included.'}
                    </p>
                  </section>
                </div>
                <div className="stack">
                  <section className="card">
                    <h2>Update status</h2>
                    {application.allowedNextStatuses.length === 0 ? (
                      <p>This application has reached a final status.</p>
                    ) : (
                      <div className="status-actions">
                        {application.allowedNextStatuses.map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={busy}
                            className={`btn ${status === 'REJECTED' ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => requestMove(status)}
                          >
                            Move to {APPLICATION_STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className="card">
                    <h2>Resume</h2>
                    {application.resume ? (
                      <div className="row-actions wrap">
                        {application.resume.mimeType === 'application/pdf' && (
                          <a
                            className="btn btn-secondary btn-sm"
                            href={`${applicationResumeUrl(application.id)}?view=1`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Resume
                          </a>
                        )}
                        <a className="btn btn-secondary btn-sm" href={applicationResumeUrl(application.id)}>
                          Download
                        </a>
                      </div>
                    ) : (
                      <p>Not available for this application.</p>
                    )}
                  </section>
                  <section className="card">
                    <h2>Status history</h2>
                    <StatusTimeline history={application.history} />
                  </section>
                </div>
              </div>
              {confirming && (
                <ConfirmDialog
                  title={`Mark as ${APPLICATION_STATUS_LABELS[confirming]}`}
                  message={`This is a final decision for ${candidate.name} and cannot be changed.`}
                  confirmLabel="Confirm"
                  danger={confirming === 'REJECTED'}
                  onClose={() => setConfirming(null)}
                  onConfirm={() => moveTo(confirming)}
                />
              )}
            </>
          );
        }}
      </AsyncView>
    </>
  );
}
