import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, MenuItem, OrderType } from '../types';

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem, quantity?: number, notes?: string) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  selectedTableId: string | null;
  setSelectedTableId: (tableId: string | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('dinedesk_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('dinedesk_cart', JSON.stringify(items));
    } catch {
      // ignore local storage errors
    }
  }, [items]);

  const addItem = (item: MenuItem, quantity = 1, notes?: string) => {
    if (!item.isAvailable) return;

    setItems((prev) => {
      const existingIndex = prev.findIndex((ci) => ci.menuItem.id === item.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        if (notes) updated[existingIndex].notes = notes;
        return updated;
      }
      return [...prev, { menuItem: item, quantity, notes }];
    });
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((ci) => ci.menuItem.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((ci) =>
        ci.menuItem.id === itemId ? { ...ci, quantity } : ci
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = Number(
    items
      .reduce((sum, item) => sum + Number(item.menuItem.price) * item.quantity, 0)
      .toFixed(2)
  );

  const tax = Number((subtotal * 0.05).toFixed(2));
  const deliveryFee = orderType === 'DELIVERY' && items.length > 0 ? 40.0 : 0.0;
  const total = Number((subtotal + tax + deliveryFee).toFixed(2));

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        tax,
        deliveryFee,
        total,
        orderType,
        setOrderType,
        selectedTableId,
        setSelectedTableId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
