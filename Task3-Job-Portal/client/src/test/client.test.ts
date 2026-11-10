import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http, NETWORK_ERROR_MESSAGE, setUnauthorizedHandler } from '../api/client';

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const failure = (promise: Promise<unknown>) => promise.catch((error: ApiError) => error);

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setUnauthorizedHandler(null);
  });

  it('returns data and leaves out empty query values', async () => {
    const fetchMock = mockFetch(200, { success: true, data: { ok: 1 } });
    await expect(http.get('/jobs', { q: 'react', location: '', page: 2 })).resolves.toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/jobs?q=react&page=2');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
  });

  it('returns items and paging details for list endpoints', async () => {
    const meta = { page: 1, limit: 10, total: 1, totalPages: 1 };
    mockFetch(200, { success: true, data: [{ id: 'a' }], meta });
    await expect(http.page('/jobs')).resolves.toEqual({ items: [{ id: 'a' }], meta });
  });

  it('maps 422 responses to field errors', async () => {
    mockFetch(422, {
      success: false,
      message: 'Please correct the highlighted fields',
      errors: [{ field: 'email', message: 'Enter a valid email address' }],
    });
    const error = (await failure(http.post('/auth/register', {}))) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.fieldErrors.email).toBe('Enter a valid email address');
  });

  it.each([
    [403, { message: 'Nope' }, 'Nope'],
    [404, {}, 'We could not find what you were looking for.'],
  ])('uses the right message for %i', async (status, body, message) => {
    mockFetch(status, body);
    const error = (await failure(http.get('/thing'))) as ApiError;
    expect(error.status).toBe(status);
    expect(error.message).toBe(message);
  });

  it('never shows raw server error text for 500 responses', async () => {
    mockFetch(500, { message: 'column "x" does not exist' });
    const error = (await failure(http.get('/thing'))) as ApiError;
    expect(error.message).not.toContain('column');
  });

  it('copes with a non-JSON error page', async () => {
    mockFetch(502, '<html>Bad gateway</html>');
    const error = (await failure(http.get('/thing'))) as ApiError;
    expect(error.status).toBe(502);
  });

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    const error = (await failure(http.get('/thing'))) as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('signals an expired session on 401 from a protected endpoint', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(401, { message: 'Authentication required' });
    await failure(http.get('/applications'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not treat a failed login as an expired session', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch(401, { message: 'Invalid email or password' });
    await failure(http.post('/auth/login', {}));
    expect(handler).not.toHaveBeenCalled();
  });
});
