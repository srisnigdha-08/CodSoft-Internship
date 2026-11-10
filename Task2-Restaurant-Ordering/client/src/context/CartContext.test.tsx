import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartProvider, MAX_ITEM_QUANTITY, useCart } from './CartContext';
import { MenuItem } from '../types';

const dish = (id: string, price: number, isAvailable = true): MenuItem =>
  ({ id, categoryId: 'c1', name: `Dish ${id}`, slug: id, description: 'A dish', price, imageUrl: '/x.svg', isVegetarian: true, isAvailable, preparationTimeMinutes: 10 }) as MenuItem;

// StrictMode invokes state updaters twice, which exposes any mutation of previous state
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <React.StrictMode>
    <CartProvider>{children}</CartProvider>
  </React.StrictMode>
);

const setup = () => renderHook(() => useCart(), { wrapper }).result;

describe('CartContext', () => {
  beforeEach(() => localStorage.clear());

  it('merges repeat additions without double counting', () => {
    const cart = setup();
    act(() => cart.current.addItem(dish('a', 100)));
    act(() => cart.current.addItem(dish('a', 100), 2));
    expect(cart.current.items).toHaveLength(1);
    expect(cart.current.items[0].quantity).toBe(3);
    expect(cart.current.itemCount).toBe(3);
  });

  it('ignores unavailable dishes', () => {
    const cart = setup();
    act(() => cart.current.addItem(dish('a', 100, false)));
    expect(cart.current.items).toHaveLength(0);
  });

  it('caps quantities at the server limit', () => {
    const cart = setup();
    act(() => cart.current.addItem(dish('a', 100), MAX_ITEM_QUANTITY + 5));
    expect(cart.current.items[0].quantity).toBe(MAX_ITEM_QUANTITY);
    act(() => cart.current.updateQuantity('a', MAX_ITEM_QUANTITY + 1));
    expect(cart.current.items[0].quantity).toBe(MAX_ITEM_QUANTITY);
  });

  it('removes a line when its quantity reaches zero', () => {
    const cart = setup();
    act(() => cart.current.addItem(dish('a', 100)));
    act(() => cart.current.updateQuantity('a', 0));
    expect(cart.current.items).toHaveLength(0);
  });

  it('removes one line and clears the cart', () => {
    const cart = setup();
    act(() => {
      cart.current.addItem(dish('a', 100));
      cart.current.addItem(dish('b', 200));
    });
    act(() => cart.current.removeItem('a'));
    expect(cart.current.items.map((i) => i.menuItem.id)).toEqual(['b']);
    act(() => cart.current.clearCart());
    expect(cart.current.items).toHaveLength(0);
  });

  it('calculates subtotal and 5% GST', () => {
    const cart = setup();
    act(() => {
      cart.current.addItem(dish('a', 440), 2);
      cart.current.addItem(dish('b', 260));
    });
    expect(cart.current.subtotal).toBe(1140);
    expect(cart.current.tax).toBe(57);
    expect(cart.current.deliveryFee).toBe(0);
    expect(cart.current.total).toBe(1197);
  });

  it('adds the delivery fee only for delivery orders', () => {
    const cart = setup();
    act(() => cart.current.setOrderType('DELIVERY'));
    expect(cart.current.deliveryFee).toBe(0);
    act(() => cart.current.addItem(dish('a', 100)));
    expect(cart.current.deliveryFee).toBe(40);
    expect(cart.current.total).toBe(145);
    act(() => cart.current.setOrderType('PICKUP'));
    expect(cart.current.deliveryFee).toBe(0);
  });

  it('persists the cart in the browser', () => {
    const cart = setup();
    act(() => cart.current.addItem(dish('a', 100)));
    expect(JSON.parse(localStorage.getItem('dinedesk_cart')!)[0].menuItem.id).toBe('a');
    expect(setup().current.items).toHaveLength(1);
  });
});
