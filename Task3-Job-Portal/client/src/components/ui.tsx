import type { ReactNode } from 'react';
import type { AsyncState } from '../hooks/useAsync';
import { APPLICATION_STATUS_LABELS, JOB_STATUS_LABELS } from '../lib/format';
import type { ApplicationStatus, JobStatus, PageMeta } from '../types';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-box">
      <svg viewBox="0 0 64 24" width="64" height="24" aria-hidden="true">
        <path
          d="M2 12c8-10 14-10 22 0s14 10 22 0 12-8 16-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-box state-error" role="alert">
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Renders the loading, error or loaded view of an async request. */
export function AsyncView<T>({
  state,
  children,
}: {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
}) {
  if (state.error) {
    return <ErrorState message={state.error.message} onRetry={() => void state.reload()} />;
  }
  if (state.data === undefined) return <Spinner />;
  return <>{children(state.data)}</>;
}

export function ApplicationBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`badge app-${status.toLowerCase()}`}>{APPLICATION_STATUS_LABELS[status]}</span>
  );
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge job-${status.toLowerCase()}`}>{JOB_STATUS_LABELS[status]}</span>;
}

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'sea' | 'amber' | 'ink';
}) {
  return (
    <div className={`stat-card ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function Pagination({
  meta,
  onChange,
}: {
  meta: PageMeta;
  onChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={meta.page <= 1}
        onClick={() => onChange(meta.page - 1)}
      >
        Previous
      </button>
      <span>
        Page {meta.page} of {meta.totalPages}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onChange(meta.page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Field({
  label,
  error,
  hint,
  group,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  /** For composite controls: a real label would activate the first button inside them. */
  group?: boolean;
  children: ReactNode;
}) {
  const content = (
    <>
      <span className="field-label">{label}</span>
      {children}
    </>
  );
  return (
    <div className={`field ${error ? 'field-invalid' : ''}`}>
      {group ? <div role="group" aria-label={label}>{content}</div> : <label>{content}</label>}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function SkillTags({ skills }: { skills: string[] }) {
  return (
    <ul className="skill-tags">
      {skills.map((skill) => (
        <li key={skill}>{skill}</li>
      ))}
    </ul>
  );
}
