import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Session, VendorOrderView } from '../types';
import { multiVendorOrder, page, product, renderAt, sessionFor, stubApi } from './harness';

const vendorSession = { 'GET /auth/me': sessionFor('VENDOR') };
const adminSession = { 'GET /auth/me': sessionFor('ADMIN') };

const vendorOrder = (): VendorOrderView => {
  const order = multiVendorOrder();
  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    paymentStatus: 'PAID',
    contact: order.contact,
    shippingAddress: order.shippingAddress,
    fulfillment: { ...order.vendorOrders[0], status: 'PENDING' },
  };
};

describe('vendor dashboard', () => {
  it('shows statistics from the API', async () => {
    stubApi({
      ...vendorSession,
      'GET /vendors/me/dashboard': { totalProducts: 6, activeProducts: 5, lowStockProducts: 1, totalOrders: 9, pendingOrders: 2, completedOrders: 7, cancelledOrders: 0, revenue: 45210.5 },
    });
    renderAt('/vendor');
    expect(await screen.findByText('₹45,210.50')).toBeInTheDocument();
    expect(screen.getByText('Total orders').parentElement).toHaveTextContent('9');
    expect(screen.getByText('Open orders').parentElement).toHaveTextContent('2');
  });

  it('warns a store that has not been approved', async () => {
    const pending: Session = { ...sessionFor('VENDOR'), vendor: { _id: 'v1', businessName: 'New Store', approvalStatus: 'PENDING' } };
    stubApi({
      'GET /auth/me': pending,
      'GET /vendors/me/dashboard': { totalProducts: 0, activeProducts: 0, lowStockProducts: 0, totalOrders: 0, pendingOrders: 0, completedOrders: 0, cancelledOrders: 0, revenue: 0 },
    });
    renderAt('/vendor');
    expect(await screen.findByText(/Your store is pending/)).toBeInTheDocument();
  });

  it('offers only valid next steps and updates fulfillment', async () => {
    const calls = stubApi({
      ...vendorSession,
      'GET /vendors/me/orders': page([vendorOrder()]),
      'PATCH /vendors/me/orders/o1/status': {},
    });
    renderAt('/vendor/orders');

    const card = await screen.findByRole('region', { name: 'Order MKT-1001' });
    expect(within(card).queryByRole('button', { name: 'Mark Delivered' })).not.toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Mark Confirmed' }));
    await waitFor(() =>
      expect(calls.find((c) => c.key === 'PATCH /vendors/me/orders/o1/status')?.body).toEqual({ status: 'CONFIRMED' }),
    );
  });

  it('adjusts inventory by a relative amount', async () => {
    const calls = stubApi({
      ...vendorSession,
      'GET /vendors/me/products': page([product()]),
      'PATCH /products/p1/stock': {},
    });
    renderAt('/vendor/inventory');
    await userEvent.type(await screen.findByLabelText('Units to adjust for Wireless Headphones'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /products/p1/stock')?.body).toEqual({ adjustment: -4 }));
  });
});

describe('admin dashboard', () => {
  it('shows marketplace statistics and a pending prompt', async () => {
    stubApi({
      ...adminSession,
      'GET /admin/dashboard': { users: 9, vendors: 6, pendingVendors: 1, products: 29, activeProducts: 29, orders: 4, revenue: 12500 },
    });
    renderAt('/admin');
    expect(await screen.findByText('₹12,500.00')).toBeInTheDocument();
    expect(screen.getByText('Users', { selector: '.stat-label' }).parentElement).toHaveTextContent('9');
    expect(screen.getByText(/1 store is waiting for approval/)).toBeInTheDocument();
  });

  it('approves a pending vendor', async () => {
    const calls = stubApi({
      ...adminSession,
      'GET /admin/vendors': page([
        {
          _id: 'v5', businessName: 'Paperleaf Stationers', contactEmail: 'p@example.com', approvalStatus: 'PENDING', createdAt: '2026-10-01',
          address: { line1: '3 College Road', city: 'Kolkata', state: 'WB', postalCode: '700001', country: 'India' },
          owner: { name: 'Tara Sen', email: 'vendor5@example.com', status: 'ACTIVE' },
        },
      ]),
      'PATCH /admin/vendors/v5/status': {},
    });
    renderAt('/admin/vendors');
    expect(await screen.findByText('Paperleaf Stationers')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /admin/vendors/v5/status')?.body).toEqual({ status: 'APPROVED' }));
  });

  it('removes role and status controls from your own row', async () => {
    stubApi({
      ...adminSession,
      'GET /admin/users': page([sessionFor('ADMIN').user, { ...sessionFor('CUSTOMER').user }]),
    });
    renderAt('/admin/users');
    await screen.findByText('(you)');
    expect(screen.getAllByRole('button', { name: 'Deactivate' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Make admin' })).toHaveLength(1);
  });

  it('shows full order, vendor and payment detail', async () => {
    stubApi({ ...adminSession, 'GET /admin/orders': page([multiVendorOrder()]) });
    renderAt('/admin/orders');
    expect(await screen.findByText('MKT-1001')).toBeInTheDocument();
    expect(screen.getByText('Riya Customer')).toBeInTheDocument();
    expect(screen.getByText('Aurora Electronics')).toBeInTheDocument();
    expect(screen.getByText('Urban Thread Co.')).toBeInTheDocument();
    expect(screen.getByText('Paid', { selector: '.badge' })).toBeInTheDocument();
  });
});
