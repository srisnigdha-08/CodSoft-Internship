import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiFailure, multiVendorCart, multiVendorOrder, page, renderAt, sessionFor, stubApi } from './harness';

const customerSession = { 'GET /auth/me': sessionFor('CUSTOMER') };

describe('multi-vendor cart', () => {
  it('groups items under each vendor with server totals', async () => {
    stubApi({ ...customerSession, 'GET /cart': { cart: multiVendorCart() } });
    renderAt('/customer/cart');

    const aurora = await screen.findByRole('region', { name: 'Items from Aurora Electronics' });
    const thread = screen.getByRole('region', { name: 'Items from Urban Thread Co.' });
    expect(within(aurora).getByText('Wireless Headphones')).toBeInTheDocument();
    expect(within(thread).getByText('Cotton T-Shirt')).toBeInTheDocument();
    expect(within(aurora).queryByText('Cotton T-Shirt')).not.toBeInTheDocument();
    expect(screen.getByText('₹5,778.46')).toBeInTheDocument();
    expect(screen.getByText(/3 items from 2 stores/)).toBeInTheDocument();
  });

  it('updates quantity and removes items through the API', async () => {
    const calls = stubApi({
      ...customerSession,
      'GET /cart': { cart: multiVendorCart() },
      'PATCH /cart/items/p1': { cart: multiVendorCart() },
      'DELETE /cart/items/p2': { cart: multiVendorCart() },
    });
    renderAt('/customer/cart');

    const stepper = await screen.findByRole('group', { name: 'Quantity of Wireless Headphones' });
    await userEvent.click(within(stepper).getByRole('button', { name: 'Increase quantity' }));
    await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /cart/items/p1')?.body).toEqual({ quantity: 2 }));

    await userEvent.click(screen.getByRole('button', { name: 'Remove Cotton T-Shirt' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /cart/items/p2')).toBe(true));
  });

  it('flags stock problems and withholds checkout', async () => {
    const cart = multiVendorCart();
    cart.canCheckout = false;
    cart.vendors[0].items[0].issue = 'INSUFFICIENT_STOCK';
    stubApi({ ...customerSession, 'GET /cart': { cart } });
    renderAt('/customer/cart');
    expect(await screen.findByText('Not enough stock for this quantity.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Proceed to checkout' })).not.toBeInTheDocument();
  });

  it('fetches the cart a bounded number of times', async () => {
    const calls = stubApi({ ...customerSession, 'GET /cart': { cart: multiVendorCart() } });
    renderAt('/customer/cart');
    await screen.findByRole('region', { name: 'Items from Aurora Electronics' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(calls.filter((c) => c.key === 'GET /cart').length).toBeLessThanOrEqual(2);
  });

  it('shows an empty cart', async () => {
    const empty = { ...multiVendorCart(), vendors: [], itemCount: 0, canCheckout: false };
    stubApi({ ...customerSession, 'GET /cart': { cart: empty } });
    renderAt('/customer/cart');
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
  });
});

describe('checkout', () => {
  async function fillAddress() {
    await userEvent.type(await screen.findByLabelText('Phone'), '+91 90000 00010');
    await userEvent.type(screen.getByLabelText('Address line 1'), '101 Maple Residency');
    await userEvent.type(screen.getByLabelText('City'), 'Chennai');
    await userEvent.type(screen.getByLabelText('State'), 'Tamil Nadu');
    await userEvent.type(screen.getByLabelText('Postal code'), '600001');
  }

  it('sends only delivery details, then continues to simulated payment', async () => {
    const calls = stubApi({
      ...customerSession,
      'GET /cart': { cart: multiVendorCart() },
      'POST /orders': { order: multiVendorOrder({ paymentStatus: 'PENDING', status: 'AWAITING_PAYMENT' }) },
      'GET /orders/o1': { order: multiVendorOrder({ paymentStatus: 'PENDING', status: 'AWAITING_PAYMENT' }), payment: null },
    });
    renderAt('/customer/checkout');
    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Place order and continue' }));

    expect(await screen.findByRole('heading', { name: 'Complete payment' })).toBeInTheDocument();
    expect(screen.getAllByText('SIMULATED PAYMENT').length).toBeGreaterThan(0);

    const body = calls.find((c) => c.key === 'POST /orders')?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['address', 'fullName', 'phone']);
  });

  it('displays stock conflicts reported by the server', async () => {
    stubApi({
      ...customerSession,
      'GET /cart': { cart: multiVendorCart() },
      'POST /orders': () => apiFailure(409, 'Some items in your cart cannot be purchased', [{ name: 'Cotton T-Shirt', issue: 'INSUFFICIENT_STOCK' }]),
    });
    renderAt('/customer/checkout');
    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Place order and continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cotton T-Shirt: not enough stock');
  });

  it('asks for no card details on the payment page', async () => {
    stubApi({
      ...customerSession,
      'GET /cart': { cart: multiVendorCart() },
      'GET /orders/o1': { order: multiVendorOrder({ paymentStatus: 'PENDING', status: 'AWAITING_PAYMENT' }), payment: null },
    });
    renderAt('/customer/orders/o1/pay');
    await screen.findByRole('heading', { name: 'Complete payment' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('reports a simulated failure and points back to the cart', async () => {
    const calls = stubApi({
      ...customerSession,
      'GET /cart': { cart: multiVendorCart() },
      'GET /orders/o1': { order: multiVendorOrder({ paymentStatus: 'PENDING', status: 'AWAITING_PAYMENT' }), payment: null },
      'POST /payments/simulate': { label: 'SIMULATED PAYMENT', payment: {}, order: multiVendorOrder() },
    });
    renderAt('/customer/orders/o1/pay');
    await userEvent.click(await screen.findByRole('button', { name: 'Simulate failed payment' }));
    expect(await screen.findByRole('heading', { name: 'Payment failed' })).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'POST /payments/simulate')?.body).toEqual({ orderId: 'o1', outcome: 'FAILURE' });
  });
});

describe('order display', () => {
  it('lists independent vendor statuses in history', async () => {
    stubApi({ ...customerSession, 'GET /cart': { cart: multiVendorCart() }, 'GET /orders': page([multiVendorOrder()]) });
    renderAt('/customer/orders');
    expect(await screen.findByText('MKT-1001')).toBeInTheDocument();
    expect(screen.getByText('Shipped')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('shows each vendor shipment, payment status and server totals', async () => {
    stubApi({
      ...customerSession,
      'GET /cart': { cart: multiVendorCart() },
      'GET /orders/o1': {
        order: multiVendorOrder(),
        payment: { _id: 'pay1', orderId: 'o1', amount: 5778.46, refundedAmount: 0, currency: 'INR', method: 'SIMULATED', status: 'PAID', reference: 'SIM-ABC' },
      },
    });
    renderAt('/customer/orders/o1');

    const aurora = await screen.findByRole('region', { name: 'Shipment from Aurora Electronics' });
    const thread = screen.getByRole('region', { name: 'Shipment from Urban Thread Co.' });
    expect(within(aurora).getAllByText('Shipped').length).toBeGreaterThan(0);
    expect(within(thread).getAllByText('Processing').length).toBeGreaterThan(0);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('SIMULATED PAYMENT')).toBeInTheDocument();
    expect(screen.getByText('₹5,778.46')).toBeInTheDocument();
    expect(screen.getByText('Reference SIM-ABC')).toBeInTheDocument();
  });
});
