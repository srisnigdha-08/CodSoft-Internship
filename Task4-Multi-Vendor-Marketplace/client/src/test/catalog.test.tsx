import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { catalogRoutes, page, product, renderAt, sessionFor, stubApi, unauthenticated, multiVendorCart } from './harness';

describe('product listing', () => {
  it('renders products returned by the API with vendor and price', async () => {
    stubApi({ ...catalogRoutes(), 'GET /auth/me': unauthenticated });
    renderAt('/products');
    expect(await screen.findByRole('link', { name: 'Wireless Headphones' })).toBeInTheDocument();
    expect(screen.getAllByText('Aurora Electronics').length).toBeGreaterThan(0);
    expect(screen.getByText('₹3,499.00')).toBeInTheDocument();
    expect(screen.getByText('1 product')).toBeInTheDocument();
  });

  it('sends search, price and sort to the backend', async () => {
    const calls = stubApi({ ...catalogRoutes(), 'GET /auth/me': unauthenticated });
    renderAt('/products');
    const filters = await screen.findByRole('form', { name: 'Product filters' });

    await userEvent.type(within(filters).getByLabelText('Search'), 'phones');
    await userEvent.type(within(filters).getByLabelText('Min price'), '100');
    await userEvent.click(within(filters).getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const last = calls.filter((c) => c.key === 'GET /products').at(-1)!;
      expect(last.url.searchParams.get('q')).toBe('phones');
      expect(last.url.searchParams.get('minPrice')).toBe('100');
    });

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'price_desc');
    await waitFor(() => {
      const last = calls.filter((c) => c.key === 'GET /products').at(-1)!;
      expect(last.url.searchParams.get('sort')).toBe('price_desc');
      expect(last.url.searchParams.get('q')).toBe('phones');
    });
  });

  it('applies category and availability filters from the backend list', async () => {
    const calls = stubApi({ ...catalogRoutes(), 'GET /auth/me': unauthenticated });
    renderAt('/products');
    await screen.findByRole('option', { name: 'Electronics' });
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'c1');
    await userEvent.selectOptions(screen.getByLabelText('Availability'), 'true');
    await waitFor(() => {
      const last = calls.filter((c) => c.key === 'GET /products').at(-1)!;
      expect(last.url.searchParams.get('category')).toBe('c1');
      expect(last.url.searchParams.get('inStock')).toBe('true');
    });
  });

  it('requests the next page', async () => {
    const calls = stubApi({
      ...catalogRoutes(),
      'GET /products': page([product()], { total: 24, totalPages: 2 }),
      'GET /auth/me': unauthenticated,
    });
    renderAt('/products');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(calls.filter((c) => c.key === 'GET /products').at(-1)!.url.searchParams.get('page')).toBe('2'));
  });

  it('shows an empty state', async () => {
    stubApi({ ...catalogRoutes([]), 'GET /auth/me': unauthenticated });
    renderAt('/products');
    expect(await screen.findByText('No products match these filters')).toBeInTheDocument();
  });

  it('sends anonymous shoppers to login when adding to cart', async () => {
    const calls = stubApi({ ...catalogRoutes(), 'GET /auth/me': unauthenticated });
    renderAt('/products');
    await screen.findByRole('link', { name: 'Wireless Headphones' });
    await userEvent.click(screen.getByRole('button', { name: 'Add Wireless Headphones to cart' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /cart/items')).toBe(false);
  });

  it('hides buying controls from vendors', async () => {
    stubApi({ ...catalogRoutes(), 'GET /auth/me': sessionFor('VENDOR') });
    renderAt('/products');
    await screen.findByRole('link', { name: 'Wireless Headphones' });
    expect(screen.queryByRole('button', { name: /to cart/ })).not.toBeInTheDocument();
  });
});

describe('product details', () => {
  const detailRoutes = {
    'GET /products/p1': { product: product({ stock: 3 }) },
    'GET /products/p1/reviews': page([{ _id: 'r1', productId: 'p1', rating: 5, title: 'Great', comment: 'Love these.', authorName: 'Riya', createdAt: '2026-10-01' }]),
  };

  it('shows details, reviews and adds the chosen quantity', async () => {
    const calls = stubApi({
      ...detailRoutes,
      'GET /auth/me': sessionFor('CUSTOMER'),
      'GET /cart': { cart: multiVendorCart() },
      'GET /products/p1/review-eligibility': { canReview: false, hasReviewed: false },
      'POST /cart/items': { cart: multiVendorCart() },
    });
    renderAt('/products/p1');

    expect(await screen.findByRole('heading', { name: 'Wireless Headphones' })).toBeInTheDocument();
    expect(screen.getByText('3 in stock')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aurora Electronics' })).toBeInTheDocument();
    expect(await screen.findByText('Love these.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    await waitFor(() =>
      expect(calls.find((c) => c.key === 'POST /cart/items')?.body).toEqual({ productId: 'p1', quantity: 2 }),
    );
  });

  it('caps the quantity selector at available stock', async () => {
    stubApi({
      ...detailRoutes,
      'GET /auth/me': sessionFor('CUSTOMER'),
      'GET /cart': { cart: multiVendorCart() },
      'GET /products/p1/review-eligibility': { canReview: false, hasReviewed: false },
    });
    renderAt('/products/p1');
    const increase = await screen.findByRole('button', { name: 'Increase quantity' });
    await userEvent.click(increase);
    await userEvent.click(increase);
    expect(increase).toBeDisabled();
  });

  it('offers the review form only when the server says the customer is eligible', async () => {
    stubApi({
      ...detailRoutes,
      'GET /auth/me': sessionFor('CUSTOMER'),
      'GET /cart': { cart: multiVendorCart() },
      'GET /products/p1/review-eligibility': { canReview: true, hasReviewed: false },
    });
    renderAt('/products/p1');
    expect(await screen.findByRole('heading', { name: 'Review this product' })).toBeInTheDocument();
  });

  it('shows the API error for a hidden product', async () => {
    stubApi({
      'GET /auth/me': unauthenticated,
      'GET /products/p9': () => new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Product not found' } }), { status: 404 }),
    });
    renderAt('/products/p9');
    expect(await screen.findByRole('alert')).toHaveTextContent('Product not found');
  });
});
