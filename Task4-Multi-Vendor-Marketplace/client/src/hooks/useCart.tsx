import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cartService } from '../services';
import type { Cart } from '../types';
import { useAuth } from './useAuth';

interface CartValue {
  cart: Cart | null;
  addItem(productId: string, quantity: number): Promise<void>;
  updateItem(productId: string, quantity: number): Promise<void>;
  removeItem(productId: string): Promise<void>;
  refresh(): Promise<void>;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const customerId = session?.user.role === 'CUSTOMER' ? session.user._id : null;
  const [stored, setStored] = useState<{ owner: string; cart: Cart } | null>(null);

  useEffect(() => {
    if (!customerId) return;
    let current = true;
    cartService.get().then(
      (cart) => {
        if (current) setStored({ owner: customerId, cart });
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [customerId]);

  const apply = useCallback(
    async (request: Promise<Cart>) => {
      const cart = await request;
      if (customerId) setStored({ owner: customerId, cart });
    },
    [customerId],
  );

  // Kept stable so pages can call refresh from an effect without refetching in a loop.
  const actions = useMemo(
    () => ({
      addItem: (productId: string, quantity: number) => apply(cartService.add(productId, quantity)),
      updateItem: (productId: string, quantity: number) => apply(cartService.update(productId, quantity)),
      removeItem: (productId: string) => apply(cartService.remove(productId)),
      refresh: () => apply(cartService.get()),
    }),
    [apply],
  );

  const value = useMemo<CartValue>(
    // Never show a previous account's cart after switching users.
    () => ({ ...actions, cart: stored && stored.owner === customerId ? stored.cart : null }),
    [actions, stored, customerId],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
