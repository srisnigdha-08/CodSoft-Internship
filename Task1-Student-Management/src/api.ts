interface ApiEnvelope<T> {
  data?: T
  meta?: unknown
  error?: { code?: string; message?: string }
}

export class ApiClientError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    if (code !== undefined) this.code = code
    this.name = 'ApiClientError'
  }
}

async function requestEnvelope<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  let payload: ApiEnvelope<T> = {}
  try {
    payload = (await response.json()) as ApiEnvelope<T>
  } catch {
    if (response.ok) throw new ApiClientError('The server returned an unreadable response.', response.status)
  }

  if (!response.ok) {
    throw new ApiClientError(payload.error?.message ?? 'The request could not be completed.', response.status, payload.error?.code)
  }
  return payload
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const payload = await requestEnvelope<T>(path, init)
  return payload.data as T
}

export async function apiRequestPage<T, M>(path: string, init: RequestInit = {}): Promise<{ data: T; meta: M }> {
  const payload = await requestEnvelope<T>(path, init)
  return { data: payload.data as T, meta: payload.meta as M }
}
