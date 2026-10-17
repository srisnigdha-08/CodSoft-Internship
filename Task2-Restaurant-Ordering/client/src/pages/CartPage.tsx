import React, { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { RestaurantTable, OrderType } from '../types';
import {
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShoppingBag,
  Utensils,
  Bike,
  PackageCheck,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';

interface CartPageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const CartPage: React.FC<CartPageProps> = ({ onNavigate }) => {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    subtotal,
    tax,
    deliveryFee,
    total,
    orderType,
    setOrderType,
    selectedTableId,
    setSelectedTableId,
  } = useCart();

  const [tables, setTables] = useState<RestaurantTable[]>([]);

  useEffect(() => {
    async function loadTables() {
      try {
        const tbls = await api.getTables();
        setTables(tbls.filter((t) => t.isActive));
        if (tbls.length > 0 && !selectedTableId) {
          setSelectedTableId(tbls[0].id);
        }
      } catch (err) {
        console.error('Failed to load tables', err);
      }
    }
    loadTables();
  }, []);

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-cream-200 text-stone-400 mx-auto flex items-center justify-center">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-3xl font-bold text-charcoal-900">Your Cart is Empty</h2>
          <p className="text-sm text-stone-500 max-w-sm mx-auto">
            You haven't added any dishes to your order yet. Explore our handcrafted digital menu.
          </p>
        </div>
        <button
          onClick={() => onNavigate('menu')}
          className="px-6 py-3 rounded-full bg-terracotta-700 hover:bg-terracotta-800 text-white font-bold text-sm shadow-md transition-all"
        >
          Browse Digital Menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between pb-4 border-b border-cream-200">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal-900">
            Shopping Cart
          </h1>
          <p className="text-xs text-stone-500 mt-1">Review your selections before proceeding to checkout</p>
        </div>

        <button
          onClick={clearCart}
          className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center space-x-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm divide-y divide-cream-100">
            {items.map((cartItem) => {
              const { menuItem, quantity, notes } = cartItem;
              const itemTotal = Number(menuItem.price) * quantity;

              return (
                <div key={menuItem.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  {/* Thumbnail & Title */}
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-stone-100 flex-shrink-0">
                      <img
                        src={menuItem.imageUrl}
                        alt={menuItem.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            menuItem.isVegetarian ? 'bg-emerald-600' : 'bg-red-600'
                          }`}
                        />
                        <h4 className="font-display text-base font-bold text-charcoal-900 truncate">
                          {menuItem.name}
                        </h4>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        ₹{Number(menuItem.price).toFixed(2)} each
                      </p>
                      {notes && (
                        <p className="text-[11px] text-terracotta-700 bg-terracotta-50 px-2 py-0.5 rounded-md inline-block mt-1 font-medium">
                          Note: {notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quantity Stepper & Price */}
                  <div className="flex items-center space-x-4 sm:space-x-6 flex-shrink-0">
                    <div className="flex items-center space-x-2 bg-cream-100 rounded-full p-1 border border-cream-300">
                      <button
                        onClick={() => updateQuantity(menuItem.id, quantity - 1)}
                        className="w-7 h-7 rounded-full bg-white hover:bg-stone-100 text-charcoal-800 flex items-center justify-center font-bold"
                        aria-label="Decrease"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-charcoal-900 px-1 min-w-[16px] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(menuItem.id, quantity + 1)}
                        className="w-7 h-7 rounded-full bg-terracotta-700 hover:bg-terracotta-800 text-white flex items-center justify-center font-bold"
                        aria-label="Increase"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[70px]">
                      <span className="font-display text-base font-bold text-charcoal-900">
                        ₹{itemTotal.toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={() => removeItem(menuItem.id)}
                      className="text-stone-400 hover:text-red-600 p-1 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dining Experience Selection (Dine-in / Pickup / Delivery) */}
          <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-4">
            <h3 className="font-display text-lg font-bold text-charcoal-900">
              Dining & Delivery Option
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setOrderType('DINE_IN')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  orderType === 'DINE_IN'
                    ? 'border-terracotta-600 bg-terracotta-50/50 ring-1 ring-terracotta-600 shadow-sm'
                    : 'border-cream-300 hover:border-cream-400 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Utensils className={`w-5 h-5 ${orderType === 'DINE_IN' ? 'text-terracotta-700' : 'text-stone-400'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Fast Service</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-charcoal-900">Dine-In Table</p>
                  <p className="text-xs text-stone-500 mt-0.5">Direct to your table</p>
                </div>
              </button>

              <button
                onClick={() => setOrderType('PICKUP')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  orderType === 'PICKUP'
                    ? 'border-terracotta-600 bg-terracotta-50/50 ring-1 ring-terracotta-600 shadow-sm'
                    : 'border-cream-300 hover:border-cream-400 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <PackageCheck className={`w-5 h-5 ${orderType === 'PICKUP' ? 'text-terracotta-700' : 'text-stone-400'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">No Wait</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-charcoal-900">Counter Pickup</p>
                  <p className="text-xs text-stone-500 mt-0.5">Collect fresh in 20m</p>
                </div>
              </button>

              <button
                onClick={() => setOrderType('DELIVERY')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  orderType === 'DELIVERY'
                    ? 'border-terracotta-600 bg-terracotta-50/50 ring-1 ring-terracotta-600 shadow-sm'
                    : 'border-cream-300 hover:border-cream-400 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Bike className={`w-5 h-5 ${orderType === 'DELIVERY' ? 'text-terracotta-700' : 'text-stone-400'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-terracotta-700">+₹40.00</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-charcoal-900">Home Delivery</p>
                  <p className="text-xs text-stone-500 mt-0.5">Hot thermal transit</p>
                </div>
              </button>
            </div>

            {/* Table Selection for Dine In */}
            {orderType === 'DINE_IN' && (
              <div className="pt-3 border-t border-cream-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Select Your Dining Table
                  </label>
                  <p className="text-xs text-stone-500">Our staff will serve your order directly to this table.</p>
                </div>
                <select
                  value={selectedTableId || ''}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-cream-300 bg-cream-50 text-sm font-semibold text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tableNumber} (Cap: {t.capacity} guests) — {t.locationDescription || 'Dining Area'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary Card */}
        <div className="lg:col-span-4">
          <div className="sticky top-28 bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-6">
            <h3 className="font-display text-xl font-bold text-charcoal-900 pb-3 border-b border-cream-100">
              Bill Summary
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-charcoal-900">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span className="flex items-center space-x-1">
                  <span>GST & Service (5%)</span>
                </span>
                <span className="font-semibold text-charcoal-900">₹{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Delivery Charges</span>
                <span className="font-semibold text-charcoal-900">
                  {deliveryFee > 0 ? `₹${deliveryFee.toFixed(2)}` : 'FREE'}
                </span>
              </div>

              <div className="pt-3 border-t border-cream-200 flex justify-between items-baseline">
                <div>
                  <span className="font-display text-lg font-bold text-charcoal-900 block">Total Due</span>
                  <span className="text-[11px] text-stone-500">Inclusive of all restaurant taxes</span>
                </div>
                <span className="font-display text-2xl font-bold text-terracotta-700">
                  ₹{total.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('checkout')}
              className="w-full py-3.5 rounded-full bg-terracotta-700 hover:bg-terracotta-800 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-terracotta-700/20 transition-all hover:scale-102 active:scale-98"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 text-center text-xs text-stone-500">
              <p>Prices recalculated and verified securely on the server.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
