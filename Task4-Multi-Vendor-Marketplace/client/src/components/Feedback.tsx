import type { ReactNode } from 'react';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | undefined | null }) {
  if (!message) return null;
  return (
    <div className="banner banner-error" role="alert">
      {message}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children && <div>{children}</div>}
    </div>
  );
}

interface ResourceViewProps<T> {
  resource: { data?: T; error?: string; loading: boolean };
  children: (data: T) => ReactNode;
}

/** Standard loading, error and success rendering for a useResource result. */
export function ResourceView<T>({ resource, children }: ResourceViewProps<T>) {
  if (resource.loading && resource.data === undefined) return <Spinner />;
  if (resource.error) return <ErrorBanner message={resource.error} />;
  if (resource.data === undefined) return <Spinner />;
  return <>{children(resource.data)}</>;
}
