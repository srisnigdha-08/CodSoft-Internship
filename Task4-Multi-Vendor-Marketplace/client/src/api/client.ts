export interface FieldProblem {
  path?: string;
  message?: string;
  name?: string;
  issue?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Query = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
}

function withQuery(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

/** All API traffic. The session lives in an HttpOnly cookie, so no token is handled here. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`/api${withQuery(path, options.query)}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as { error?: { code: string; message: string; details?: unknown } } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'The request could not be completed',
      error?.details,
    );
  }
  return payload as T;
}

/** Turns any thrown value into text suitable for showing to the user. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const problems = Array.isArray(error.details) ? (error.details as FieldProblem[]) : [];
    const lines = problems
      .map((p) => (p.path ? `${p.path}: ${p.message}` : p.name ? `${p.name}: ${issueLabel(p.issue)}` : null))
      .filter(Boolean);
    return lines.length > 0 ? `${error.message}. ${lines.join('; ')}` : error.message;
  }
  return 'Could not reach the server. Please try again.';
}

function issueLabel(issue?: string): string {
  return issue === 'INSUFFICIENT_STOCK' ? 'not enough stock' : 'no longer available';
}
