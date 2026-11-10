import { useCallback, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { applicationsApi, jobsApi, seekerApi } from '../../api';
import { Modal } from '../../components/Modal';
import { AsyncView, Field, JobStatusBadge, SkillTags, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import {
  APPLICATION_STATUS_LABELS,
  EXPERIENCE_LABELS,
  formatDate,
  formatSalary,
  JOB_TYPE_LABELS,
  WORK_MODE_LABELS,
} from '../../lib/format';
import type { JobDetails } from '../../types';

function ApplyDialog({
  job,
  onClose,
  onApplied,
}: {
  job: JobDetails;
  onClose: () => void;
  onApplied: () => void;
}) {
  const resume = useAsync(useCallback(() => seekerApi.resume(), []));
  const [coverLetter, setCoverLetter] = useState('');
  const { busy, errors, run } = useAction();

  const submit = async () => {
    const ok = await run(
      () => applicationsApi.apply(job.id, coverLetter),
      'Your application has been submitted.',
    );
    if (ok) onApplied();
  };

  return (
    <Modal title={`Apply for ${job.title}`} onClose={onClose}>
      <div className="modal-body">
        {resume.loading && resume.data === undefined ? (
          <Spinner label="Checking your resume…" />
        ) : resume.data ? (
          <p className="notice">
            Your current resume, <strong>{resume.data.originalName}</strong>, will be attached.
          </p>
        ) : (
          <p className="notice notice-warn">
            You need a resume to apply. <Link to="/job-seeker/resume">Upload one now</Link>.
          </p>
        )}
        <Field label="Cover letter (optional)" error={errors.coverLetter}>
          <textarea
            rows={7}
            maxLength={5000}
            value={coverLetter}
            onChange={(event) => setCoverLetter(event.target.value)}
          />
        </Field>
      </div>
      <footer className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !resume.data}
          onClick={() => void submit()}
        >
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
      </footer>
    </Modal>
  );
}

function ApplyPanel({ job, onApplied }: { job: JobDetails; onApplied: () => void }) {
  const { user } = useAuth();
  const location = useLocation();
  const [applying, setApplying] = useState(false);

  if (job.viewerApplication) {
    return (
      <div className="apply-panel">
        <button type="button" className="btn btn-block" disabled>
          Already Applied
        </button>
        <Link to={`/job-seeker/applications/${job.viewerApplication.id}`} className="apply-note">
          Status: {APPLICATION_STATUS_LABELS[job.viewerApplication.status]} — view application
        </Link>
      </div>
    );
  }
  if (!job.applicationsOpen) {
    return (
      <div className="apply-panel">
        <button type="button" className="btn btn-block" disabled>
          Applications Closed
        </button>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="apply-panel">
        <Link to="/login" state={{ from: location.pathname }} className="btn btn-primary btn-block">
          Sign in to apply
        </Link>
      </div>
    );
  }
  if (user.role !== 'JOB_SEEKER') {
    return (
      <div className="apply-panel">
        <p className="apply-note">Only job seeker accounts can apply.</p>
      </div>
    );
  }
  return (
    <div className="apply-panel">
      <button type="button" className="btn btn-primary btn-block" onClick={() => setApplying(true)}>
        Apply Now
      </button>
      {applying && (
        <ApplyDialog
          job={job}
          onClose={() => setApplying(false)}
          onApplied={() => {
            setApplying(false);
            onApplied();
          }}
        />
      )}
    </div>
  );
}

function TextSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      <p className="preserve-lines">{text}</p>
    </section>
  );
}

export function JobDetailsPage() {
  const { id = '' } = useParams();
  const state = useAsync(useCallback(() => jobsApi.details(id), [id]));

  return (
    <main className="container job-details">
      <Link to="/jobs" className="back-link">
        ← All jobs
      </Link>
      <AsyncView state={state}>
        {(job) => (
          <div className="detail-layout">
            <article className="card detail-main">
              <header className="detail-head">
                <div className="company-mark company-mark-lg" aria-hidden="true">
                  {job.company.name.charAt(0)}
                </div>
                <div>
                  <h1>{job.title}</h1>
                  <p className="job-company">
                    {job.company.name} · {job.location}
                  </p>
                  {job.canManage && <JobStatusBadge status={job.status} />}
                </div>
              </header>
              <TextSection title="About the role" text={job.description} />
              <TextSection title="Requirements" text={job.requirements} />
              <TextSection title="Responsibilities" text={job.responsibilities} />
              <section className="detail-section">
                <h2>Required skills</h2>
                <SkillTags skills={job.skills} />
              </section>
              {job.company.description && (
                <TextSection title={`About ${job.company.name}`} text={job.company.description} />
              )}
            </article>

            <aside className="card detail-side">
              <ApplyPanel job={job} onApplied={() => void state.reload()} />
              <dl className="facts">
                <dt>Salary</dt>
                <dd>{formatSalary(job.salaryMin, job.salaryMax)}</dd>
                <dt>Job type</dt>
                <dd>{JOB_TYPE_LABELS[job.jobType]}</dd>
                <dt>Work mode</dt>
                <dd>{WORK_MODE_LABELS[job.workMode]}</dd>
                <dt>Experience</dt>
                <dd>{EXPERIENCE_LABELS[job.experienceLevel]}</dd>
                <dt>Location</dt>
                <dd>{job.location}</dd>
                <dt>Posted</dt>
                <dd>{formatDate(job.publishedAt)}</dd>
                <dt>Application deadline</dt>
                <dd>{job.expiresAt ? formatDate(job.expiresAt) : 'Open until filled'}</dd>
              </dl>
            </aside>
          </div>
        )}
      </AsyncView>
    </main>
  );
}
