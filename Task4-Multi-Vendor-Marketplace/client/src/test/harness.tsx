import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppProviders } from '../App';
import { AppRoutes } from '../routes/AppRoutes';
import type { Cart, Order, Product, Role, Session } from '../types';

type Handler = unknown | ((request: { url: URL; body: unknown }) => unknown);
export type Routes = Record<string, Handler>;

export interface RecordedCall {
  key: string;
  url: URL;
  body: unknown;
}

/**
 * Replaces the network only. The real API client, providers, router and pages
 * run, so tests see the same requests the browser would send.
 */
export function stubApi(routes: Routes) {
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    const key = `${init?.method ?? 'GET'} ${url.pathname.replace(/^\/api/, '')}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ key, url, body });

    if (!(key in routes)) {
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: `No stub for ${key}` } }), { status: 404 });
    }
    const handler = routes[key];
    const result = typeof handler === 'function' ? await (handler as (r: { url: URL; body: unknown }) => unknown)({ url, body }) : handler;
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

export const unauthenticated = () =>
  new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }), { status: 401 });

export const apiFailure = (status: number, message: string, details?: unknown) =>
  new Response(JSON.stringify({ error: { code: 'ERROR', message, details } }), { status });

export function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}

export const sessionFor = (role: Role): Session => ({
  user: { _id: `${role}-id`, name: `${role} Person`, email: `${role.toLowerCase()}@example.com`, role, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' },
  vendor: role === 'VENDOR' ? { _id: 'v1', businessName: 'Aurora Electronics', approvalStatus: 'APPROVED' } : null,
});

export const product = (overrides: Partial<Product> = {}): Product => ({
  _id: 'p1',
  name: 'Wireless Headphones',
  description: 'Over-ear headphones with a long battery life.',
  images: ['/catalog/hp.svg'],
  price: 3499,
  stock: 25,
  sku: 'AUR-HP-01',
  isActive: true,
  rating: 4.5,
  reviewCount: 2,
  vendorId: 'v1',
  categoryId: 'c1',
  vendor: { _id: 'v1', businessName: 'Aurora Electronics', approvalStatus: 'APPROVED' },
  category: { _id: 'c1', name: 'Electronics' },
  ...overrides,
});

export const page = <T,>(items: T[], overrides = {}) => ({ items, page: 1, limit: 12, total: items.length, totalPages: 1, ...overrides });

export const multiVendorCart = (): Cart => ({
  vendors: [
    {
      vendor: { _id: 'v1', businessName: 'Aurora Electronics' },
      items: [{ productId: 'p1', name: 'Wireless Headphones', unitPrice: 3499, quantity: 1, lineTotal: 3499, stock: 25, issue: null }],
      totals: { subtotal: 3499, tax: 629.82, deliveryFee: 0, total: 4128.82 },
    },
    {
      vendor: { _id: 'v2', businessName: 'Urban Thread Co.' },
      items: [{ productId: 'p2', name: 'Cotton T-Shirt', unitPrice: 699, quantity: 2, lineTotal: 1398, stock: 120, issue: null }],
      totals: { subtotal: 1398, tax: 251.64, deliveryFee: 0, total: 1649.64 },
    },
  ],
  totals: { subtotal: 4897, tax: 881.46, deliveryFee: 0, grandTotal: 5778.46 },
  itemCount: 3,
  canCheckout: true,
});

export const multiVendorOrder = (overrides: Partial<Order> = {}): Order => ({
  _id: 'o1',
  orderNumber: 'MKT-1001',
  customerId: 'CUSTOMER-id',
  contact: { fullName: 'Riya Customer', email: 'customer@example.com', phone: '+91 90000 00010' },
  shippingAddress: { line1: '101 Maple Residency', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001', country: 'India' },
  vendorOrders: [
    {
      _id: 'vo1', vendorId: 'v1', vendorName: 'Aurora Electronics', status: 'SHIPPED', statusHistory: [],
      items: [{ productId: 'p1', name: 'Wireless Headphones', sku: 'A', unitPrice: 3499, quantity: 1, lineTotal: 3499 }],
      subtotal: 3499, tax: 629.82, deliveryFee: 0, total: 4128.82,
    },
    {
      _id: 'vo2', vendorId: 'v2', vendorName: 'Urban Thread Co.', status: 'PROCESSING', statusHistory: [],
      items: [{ productId: 'p2', name: 'Cotton T-Shirt', sku: 'B', unitPrice: 699, quantity: 2, lineTotal: 1398 }],
      subtotal: 1398, tax: 251.64, deliveryFee: 0, total: 1649.64,
    },
  ],
  subtotal: 4897,
  tax: 881.46,
  deliveryFee: 0,
  grandTotal: 5778.46,
  paymentStatus: 'PAID',
  status: 'IN_PROGRESS',
  createdAt: '2026-11-01T10:00:00Z',
  ...overrides,
});

export const catalogRoutes = (items: Product[] = [product()]): Routes => ({
  'GET /products': page(items),
  'GET /categories': { items: [{ _id: 'c1', name: 'Electronics', isActive: true }] },
  'GET /vendors': page([{ _id: 'v1', businessName: 'Aurora Electronics', city: 'Bengaluru', state: 'Karnataka', createdAt: '2026-01-01', productCount: 5 }]),
});
