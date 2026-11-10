import type { Page, PageMeta } from '../types';

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Please sign in to continue.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  422: 'Please check the information you entered.',
  429: 'Too many attempts. Please try again later.',
};

const SERVER_ERROR_MESSAGE = 'The server had a problem. Please try again shortly.';
export const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Check your connection and retry.';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const toApiError = (error: unknown): ApiError =>
  error instanceof ApiError ? error : new ApiError(0, NETWORK_ERROR_MESSAGE);

interface ResponseBody {
  data?: unknown;
  meta?: PageMeta;
  message?: string;
  errors?: { field: string; message: string }[];
  job?: unknown;
}

type QueryValue = string | number | undefined | null;

let unauthorizedHandler: (() => void) | null = null;

/** Registers what to do when an established session stops being valid. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function withQuery(path: string, query?: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((query ?? {}) as Record<string, QueryValue>)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

async function send(path: string, init: RequestInit = {}): Promise<ResponseBody> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }
  // Error pages from a proxy may not be JSON, so an unreadable body is treated as empty.
  const body = (await response.json().catch(() => ({}))) as ResponseBody;
  if (response.ok) return body;

  // Login failures and the startup session probe are normal outcomes, not an expired session.
  if (response.status === 401 && !path.startsWith('/auth/')) unauthorizedHandler?.();

  const fallback = STATUS_MESSAGES[response.status] ?? SERVER_ERROR_MESSAGE;
  const message = response.status >= 500 ? SERVER_ERROR_MESSAGE : (body.message ?? fallback);
  const fieldErrors = Object.fromEntries((body.errors ?? []).map((e) => [e.field, e.message]));
  throw new ApiError(response.status, message, fieldErrors);
}

const jsonInit = (method: string, payload?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: payload === undefined ? undefined : JSON.stringify(payload),
});

export const http = {
  get: async <T>(path: string, query?: object) => (await send(withQuery(path, query))).data as T,
  page: async <T>(path: string, query?: object): Promise<Page<T>> => {
    const body = await send(withQuery(path, query));
    return { items: body.data as T[], meta: body.meta as PageMeta };
  },
  pageWith: async <T, E>(path: string, key: 'job', query?: object) => {
    const body = await send(withQuery(path, query));
    return { items: body.data as T[], meta: body.meta as PageMeta, [key]: body[key] as E };
  },
  post: async <T>(path: string, payload?: unknown) =>
    (await send(path, jsonInit('POST', payload))).data as T,
  put: async <T>(path: string, payload: unknown) =>
    (await send(path, jsonInit('PUT', payload))).data as T,
  patch: async <T>(path: string, payload: unknown) =>
    (await send(path, jsonInit('PATCH', payload))).data as T,
  delete: async (path: string): Promise<void> => {
    await send(path, { method: 'DELETE' });
  },
  upload: async <T>(path: string, form: FormData) =>
    (await send(path, { method: 'POST', body: form })).data as T,
};
