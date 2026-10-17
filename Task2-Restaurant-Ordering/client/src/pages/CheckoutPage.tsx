import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { PaymentMethod } from '../types';
import {
  CreditCard,
  Banknote,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Utensils,
  MapPin,
  Sparkles,
} from 'lucide-react';

interface CheckoutPageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onNavigate }) => {
  const { items, orderType, selectedTableId, subtotal, tax, deliveryFee, total, clearCart } = useCart();
  const { user } = useAuth();

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '+91 98765 43212');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MOCK_ONLINE');
  const [simulateFailure, setSimulateFailure] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.name);
      if (!customerEmail) setCustomerEmail(user.email);
      if (!customerPhone && user.phone) setCustomerPhone(user.phone);
    }
  }, [user]);

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold">No Items to Checkout</h2>
        <p className="text-xs text-stone-500">Your shopping cart is empty.</p>
        <button
          onClick={() => onNavigate('menu')}
          className="px-5 py-2.5 rounded-full bg-terracotta-700 text-white text-xs font-bold"
        >
          Return to Menu
        </button>
      </div>
    );
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Front-end validations
    if (!customerName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.length < 7) {
      setErrorMsg('Please enter a valid phone number.');
      return;
    }
    if (orderType === 'DELIVERY' && (!deliveryAddress || deliveryAddress.trim().length < 5)) {
      setErrorMsg('A detailed delivery street address is required for delivery.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Submit order to server (server validates menu items & recalculates prices)
      const orderData = {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        customerPhone: customerPhone.trim(),
        orderType,
        tableId: orderType === 'DINE_IN' ? selectedTableId : null,
        deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress.trim() : null,
        notes: notes.trim() || null,
        paymentMethod,
        items: items.map((ci) => ({
          menuItemId: ci.menuItem.id,
          quantity: ci.quantity,
          notes: ci.notes || null,
        })),
      };

      const createdOrder = await api.createOrder(orderData);

      // If simulated failure requested for test coverage:
      if (simulateFailure) {
        try {
          await api.processPaymentCheckout({
            orderId: createdOrder.id,
            method: paymentMethod,
            simulateFailure: true,
          });
        } catch (paymentErr: any) {
          setErrorMsg(
            `Payment Simulation: ${paymentErr.message || 'Payment failed as requested for testing failure path'}. Order created with status PENDING.`
          );
          clearCart();
          onNavigate('order-detail', createdOrder.id);
          return;
        }
      }

      clearCart();
      // Navigate to live order tracker page
      onNavigate('order-detail', createdOrder.id);
    } catch (err: any) {
      console.error('Order creation error:', err);
      setErrorMsg(err.message || 'Failed to place order. Please check your information and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header with Back to Cart */}
      <div className="flex items-center space-x-4 pb-4 border-b border-cream-200">
        <button
          onClick={() => onNavigate('cart')}
          className="p-2 rounded-full hover:bg-cream-200 text-charcoal-800 transition-colors"
          title="Back to Cart"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal-900">
            Order Checkout
          </h1>
          <p className="text-xs text-stone-500">
            Confirm your dining details and choose your payment method
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-800 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Order Notice</p>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Form Fields */}
        <div className="md:col-span-7 space-y-6">
          {/* Customer Details Section */}
          <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-4">
            <h3 className="font-display text-lg font-bold text-charcoal-900">
              1. Guest Information
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="priya@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
                  />
                </div>
              </div>

              {orderType === 'DELIVERY' && (
                <div>
                  <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                    Delivery Address *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter complete house/flat number, building name, street, and landmark..."
                    className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Kitchen Notes / Dietary Requests
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please ring bell upon arrival, allergy alerts..."
                  className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Section */}
          <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-4">
            <h3 className="font-display text-lg font-bold text-charcoal-900">
              2. Payment Method
            </h3>

            <div className="space-y-3">
              <label
                className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  paymentMethod === 'MOCK_ONLINE'
                    ? 'border-terracotta-600 bg-terracotta-50/40 ring-1 ring-terracotta-600'
                    : 'border-cream-300 bg-white hover:bg-cream-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="MOCK_ONLINE"
                    checked={paymentMethod === 'MOCK_ONLINE'}
                    onChange={() => setPaymentMethod('MOCK_ONLINE')}
                    className="text-terracotta-700 focus:ring-terracotta-500"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-terracotta-700" />
                      <span className="text-sm font-bold text-charcoal-900">Online Payment Gateway</span>
                    </div>
                    <span className="text-xs text-stone-500">
                      Supports UPI, Cards, NetBanking (Verified development mock adapter)
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                  Instant
                </span>
              </label>

              <label
                className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  paymentMethod === 'CASH'
                    ? 'border-terracotta-600 bg-terracotta-50/40 ring-1 ring-terracotta-600'
                    : 'border-cream-300 bg-white hover:bg-cream-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CASH"
                    checked={paymentMethod === 'CASH'}
                    onChange={() => setPaymentMethod('CASH')}
                    className="text-terracotta-700 focus:ring-terracotta-500"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <Banknote className="w-4 h-4 text-stone-600" />
                      <span className="text-sm font-bold text-charcoal-900">
                        {orderType === 'DINE_IN' ? 'Pay Cash at Table' : 'Cash on Delivery'}
                      </span>
                    </div>
                    <span className="text-xs text-stone-500">
                      Pay our server or delivery personnel upon food handover
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                  On Handover
                </span>
              </label>
            </div>

            {/* QA Testing: Simulation Toggle */}
            <div className="pt-2">
              <label className="flex items-center space-x-2 text-xs text-stone-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="rounded text-terracotta-600 focus:ring-terracotta-500"
                />
                <span className="italic">
                  QA Tester: Simulate Payment Decline / Gateway Failure path
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Order Confirmation Breakdown */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-5">
            <h3 className="font-display text-lg font-bold text-charcoal-900 pb-3 border-b border-cream-100">
              Order Summary ({items.length} item{items.length > 1 ? 's' : ''})
            </h3>

            {/* Selected Items Mini List */}
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {items.map((ci) => (
                <div key={ci.menuItem.id} className="flex justify-between text-xs">
                  <span className="text-stone-700 font-medium line-clamp-1">
                    {ci.quantity}x {ci.menuItem.name}
                  </span>
                  <span className="text-charcoal-900 font-bold ml-2">
                    ₹{(Number(ci.menuItem.price) * ci.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals Calculation */}
            <div className="pt-3 border-t border-cream-100 space-y-2 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>GST (5%)</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Delivery Fee</span>
                <span>{deliveryFee > 0 ? `₹${deliveryFee.toFixed(2)}` : 'FREE'}</span>
              </div>
              <div className="pt-2 border-t border-cream-200 flex justify-between text-base font-bold text-charcoal-900">
                <span>Grand Total</span>
                <span className="font-display text-xl text-terracotta-700">
                  ₹{total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-full bg-terracotta-700 hover:bg-terracotta-800 disabled:bg-stone-300 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-terracotta-700/20 transition-all active:scale-98"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Placing Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Place Order • ₹{total.toFixed(2)}</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center space-x-1.5 text-[11px] text-stone-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Secure PostgreSQL Transaction</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
