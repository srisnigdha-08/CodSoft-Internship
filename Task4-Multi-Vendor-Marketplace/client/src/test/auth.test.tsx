import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiFailure, catalogRoutes, renderAt, sessionFor, stubApi, unauthenticated } from './harness';

describe('login', () => {
  it('submits credentials and sends a customer to the storefront', async () => {
    const calls = stubApi({
      ...catalogRoutes(),
      'GET /auth/me': unauthenticated,
      'POST /auth/login': sessionFor('CUSTOMER'),
      'GET /cart': { cart: { vendors: [], totals: { subtotal: 0, tax: 0, deliveryFee: 0, grandTotal: 0 }, itemCount: 0, canCheckout: false } },
    });
    renderAt('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'customer@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Customer@12345');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Shop by category')).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'POST /auth/login')?.body).toEqual({
      email: 'customer@example.com',
      password: 'Customer@12345',
    });
  });

  it('never writes a token to browser storage', async () => {
    stubApi({ ...catalogRoutes(), 'GET /auth/me': unauthenticated, 'POST /auth/login': sessionFor('ADMIN'), 'GET /admin/dashboard': { users: 1, vendors: 1, pendingVendors: 0, products: 0, activeProducts: 0, orders: 0, revenue: 0 } });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'admin@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Admin@12345');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Marketplace overview');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('shows the server error for bad credentials', async () => {
    stubApi({ 'GET /auth/me': unauthenticated, 'POST /auth/login': () => apiFailure(401, 'Incorrect email or password') });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
  });
});

describe('protected routes', () => {
  it.each(['/customer/cart', '/vendor', '/admin'])('redirects anonymous visitors from %s to login', async (path) => {
    stubApi({ 'GET /auth/me': unauthenticated });
    renderAt(path);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('keeps a customer out of the admin console', async () => {
    const calls = stubApi({
      ...catalogRoutes(),
      'GET /auth/me': sessionFor('CUSTOMER'),
      'GET /cart': { cart: { vendors: [], totals: { subtotal: 0, tax: 0, deliveryFee: 0, grandTotal: 0 }, itemCount: 0, canCheckout: false } },
    });
    renderAt('/admin');
    expect(await screen.findByText('Shop by category')).toBeInTheDocument();
    expect(screen.queryByText('Marketplace overview')).not.toBeInTheDocument();
    expect(calls.some((c) => c.key.includes('/admin'))).toBe(false);
  });

  it('keeps a vendor out of the customer area', async () => {
    stubApi({
      'GET /auth/me': sessionFor('VENDOR'),
      'GET /vendors/me/dashboard': { totalProducts: 1, activeProducts: 1, lowStockProducts: 0, totalOrders: 0, pendingOrders: 0, completedOrders: 0, cancelledOrders: 0, revenue: 0 },
    });
    renderAt('/customer/orders');
    expect(await screen.findByText('Store performance at a glance.')).toBeInTheDocument();
  });

  it('returns a visitor to the page they asked for after signing in', async () => {
    stubApi({
      'GET /auth/me': unauthenticated,
      'POST /auth/login': sessionFor('CUSTOMER'),
      'GET /cart': { cart: { vendors: [], totals: { subtotal: 0, tax: 0, deliveryFee: 0, grandTotal: 0 }, itemCount: 0, canCheckout: false } },
      'GET /orders': { items: [], page: 1, limit: 10, total: 0, totalPages: 1 },
    });
    renderAt('/customer/orders');
    await userEvent.type(await screen.findByLabelText('Email'), 'c@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText('No orders yet')).toBeInTheDocument());
  });
});
