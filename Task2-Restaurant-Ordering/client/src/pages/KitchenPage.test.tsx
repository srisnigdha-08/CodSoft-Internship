import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KitchenPage } from './KitchenPage';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../services/api', () => ({ api: { getKitchenOrders: vi.fn(), updateOrderStatus: vi.fn() } }));

const order = (id: string, status: string) => ({
  id,
  orderNumber: `ORD-${id}`,
  status,
  orderType: 'PICKUP',
  items: [{ id: `${id}-1`, name: 'Dish', quantity: 1 }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const signInAs = (role: string | null) =>
  vi.mocked(useAuth).mockReturnValue({ user: role ? { id: 'u1', role } : null } as any);

describe('KitchenPage', () => {
  afterEach(cleanup);

  it.each([[null], ['CUSTOMER']])('restricts the board and does not load orders for %s', (role) => {
    signInAs(role);

    render(<KitchenPage onNavigate={vi.fn()} />);

    expect(screen.getByText('Kitchen Portal Restricted')).toBeTruthy();
    expect(api.getKitchenOrders).not.toHaveBeenCalled();
  });

  it('confirms a pending order before cooking', async () => {
    signInAs('KITCHEN_STAFF');
    vi.mocked(api.getKitchenOrders).mockResolvedValue([order('a', 'PENDING')] as any);
    vi.mocked(api.updateOrderStatus).mockResolvedValue({} as any);

    render(<KitchenPage onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByText('Confirm Order'));

    await waitFor(() => expect(api.updateOrderStatus).toHaveBeenCalledWith('a', 'CONFIRMED'));
  });

  it.each([
    ['CONFIRMED', 'Accept & Start Cooking', 'PREPARING'],
    ['PREPARING', 'Mark Plated & Ready', 'READY'],
    ['READY', 'Complete & Handover', 'COMPLETED'],
  ])('advances a %s order', async (status, label, next) => {
    signInAs('ADMIN');
    vi.mocked(api.getKitchenOrders).mockResolvedValue([order('b', status)] as any);
    vi.mocked(api.updateOrderStatus).mockResolvedValue({} as any);

    render(<KitchenPage onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByText(label));

    await waitFor(() => expect(api.updateOrderStatus).toHaveBeenCalledWith('b', next));
  });
});
