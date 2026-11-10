import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const respondWith = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('api client', () => {
  beforeEach(() => localStorage.clear());

  it('relies on the HttpOnly cookie and never sends or stores a token', async () => {
    localStorage.setItem('dinedesk_token', 'stale-token');
    const fetchMock = respondWith(200, { success: true, data: { user: { id: 'u1' } } });

    await api.login({ email: 'a@b.co', password: 'secret' });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(Object.keys(localStorage).filter((key) => key !== 'dinedesk_token')).toEqual([]);
  });

  it('requests order history without identifying parameters', async () => {
    const fetchMock = respondWith(200, { success: true, data: { orders: [] } });

    await api.getMyOrders();

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/orders/my');
  });

  it('prefers the first field-level validation message', async () => {
    respondWith(400, { success: false, message: 'Validation failed', errors: [{ field: 'items', message: 'Quantity must be at least 1' }] });

    await expect(api.createOrder({})).rejects.toMatchObject({ message: 'Quantity must be at least 1', status: 400 });
  });

  it('reports a friendly error when the server does not return JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(api.getCategories()).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/unavailable/i) });
  });
});
