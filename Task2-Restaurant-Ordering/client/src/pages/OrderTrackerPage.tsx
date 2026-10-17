import React, { useEffect, useState } from 'react';
import { Order, OrderStatus } from '../types';
import { api } from '../services/api';
import {
  Clock,
  CheckCircle,
  ChefHat,
  ShoppingBag,
  Bike,
  Utensils,
  AlertCircle,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Receipt,
} from 'lucide-react';

interface OrderTrackerPageProps {
  orderId: string;
  onNavigate: (page: string, param?: string) => void;
}

const statusSteps: { key: OrderStatus; label: string; icon: any; description: string }[] = [
  {
    key: 'PENDING',
    label: 'Order Placed',
    icon: ShoppingBag,
    description: 'Received by DineDesk platform',
  },
  {
    key: 'CONFIRMED',
    label: 'Confirmed',
    icon: CheckCircle,
    description: 'Payment verified & assigned',
  },
  {
    key: 'PREPARING',
    label: 'In Kitchen',
    icon: ChefHat,
    description: 'Chefs are crafting your dishes',
  },
  {
    key: 'READY',
    label: 'Ready',
    icon: Utensils,
    description: 'Plated for table / packed for transit',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    icon: CheckCircle,
    description: 'Served & enjoyed',
  },
];

export const OrderTrackerPage: React.FC<OrderTrackerPageProps> = ({ orderId, onNavigate }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function fetchOrderDetails() {
    try {
      const fetched = await api.getOrder(orderId);
      setOrder(fetched);
      setLastUpdated(new Date());
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to retrieve order status');
    } finally {
      setLoading(false);
    }
  }

  // Initial load and live polling every 4 seconds
  useEffect(() => {
    fetchOrderDetails();
    const interval = setInterval(fetchOrderDetails, 4000);
    return () => clearInterval(interval);
  }, [orderId]);

  const handleCancelOrder = async () => {
    if (!order) return;
    const confirm = window.confirm('Are you sure you want to cancel this order?');
    if (!confirm) return;

    setCancelling(true);
    try {
      const updated = await api.cancelOrder(order.id, 'Cancelled by customer via tracker interface');
      setOrder(updated);
    } catch (err: any) {
      alert(err.message || 'Unable to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-terracotta-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-stone-500 font-medium">Connecting to DineDesk order pipeline...</p>
      </div>
    );
  }

  if (!order || errorMsg) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="font-display text-2xl font-bold">Order Not Found</h2>
        <p className="text-xs text-stone-500">{errorMsg || 'Could not locate order details.'}</p>
        <button
          onClick={() => onNavigate('orders')}
          className="px-5 py-2.5 rounded-full bg-terracotta-700 text-white text-xs font-bold"
        >
          View All Orders
        </button>
      </div>
    );
  }

  const isCancelled = order.status === 'CANCELLED';
  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header and Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cream-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('orders')}
            className="p-2 rounded-full hover:bg-cream-200 text-charcoal-800 transition-colors"
            title="My Orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900">
                Order {order.orderNumber}
              </h1>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase ${
                  isCancelled
                    ? 'bg-red-100 text-red-700'
                    : order.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900 animate-pulse'
                }`}
              >
                {order.status}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Placed on {new Date(order.createdAt).toLocaleDateString()} at{' '}
              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Polling Heartbeat Badge */}
        <div className="flex items-center space-x-2 text-[11px] text-stone-400 self-end sm:self-center">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-terracotta-600" />
          <span>Live Tracking Active ({lastUpdated.toLocaleTimeString()})</span>
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cream-200 shadow-sm space-y-6">
        <h3 className="font-display text-lg font-bold text-charcoal-900">
          Order Progress
        </h3>

        {isCancelled ? (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center space-x-3 text-red-800">
            <XCircle className="w-6 h-6 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-bold text-sm">Order Cancelled</p>
              <p className="text-xs text-red-700 mt-0.5">
                This order was cancelled. Any online payment has been marked for automated refund.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Progress Bar Line */}
            <div className="hidden sm:block absolute top-6 left-12 right-12 h-1 bg-cream-200 -z-0">
              <div
                className="h-full bg-gradient-to-r from-terracotta-600 to-amber-500 transition-all duration-500"
                style={{
                  width: `${(Math.max(0, currentStepIndex) / (statusSteps.length - 1)) * 100}%`,
                }}
              />
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 relative z-10">
              {statusSteps.map((step, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;
                const IconComponent = step.icon;

                return (
                  <div key={step.key} className="flex sm:flex-col items-center text-left sm:text-center space-x-4 sm:space-x-0">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm ${
                        isCurrent
                          ? 'bg-terracotta-700 text-white ring-4 ring-terracotta-200 scale-110'
                          : isPassed
                          ? 'bg-amber-600 text-white'
                          : 'bg-cream-200 text-stone-400'
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="sm:mt-3">
                      <p
                        className={`text-xs font-bold ${
                          isCurrent
                            ? 'text-terracotta-700'
                            : isPassed
                            ? 'text-charcoal-900'
                            : 'text-stone-400'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancellation Option (Only available when PENDING or CONFIRMED) */}
        {!isCancelled && (order.status === 'PENDING' || order.status === 'CONFIRMED') && (
          <div className="pt-4 border-t border-cream-100 flex items-center justify-between">
            <p className="text-xs text-stone-500">
              Order not yet in active kitchen preparation. You may still cancel if needed.
            </p>
            <button
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="px-4 py-2 rounded-full border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          </div>
        )}
      </div>

      {/* Order Details & Receipt */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Ordered Dishes List */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-cream-100">
            <Receipt className="w-4 h-4 text-terracotta-700" />
            <h3 className="font-display text-lg font-bold text-charcoal-900">
              Dishes Ordered
            </h3>
          </div>

          <div className="divide-y divide-cream-100">
            {order.items.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-charcoal-900">
                    {item.quantity}x {item.name}
                  </p>
                  <p className="text-[11px] text-stone-500">
                    ₹{Number(item.price).toFixed(2)} each
                  </p>
                  {item.notes && (
                    <p className="text-[11px] text-terracotta-700 italic">
                      "{item.notes}"
                    </p>
                  )}
                </div>
                <span className="font-display text-sm font-bold text-charcoal-900">
                  ₹{Number(item.subtotal).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Pricing Breakdown */}
          <div className="pt-3 border-t border-cream-200 space-y-1.5 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{Number(order.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST & Taxes (5%)</span>
              <span>₹{Number(order.tax).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <span>₹{Number(order.deliveryFee).toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-cream-200 flex justify-between text-sm font-bold text-charcoal-900">
              <span>Total Amount</span>
              <span className="font-display text-base text-terracotta-700">
                ₹{Number(order.totalAmount).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Fulfillment & Payment Details */}
        <div className="md:col-span-5 bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-4">
          <h3 className="font-display text-lg font-bold text-charcoal-900 pb-3 border-b border-cream-100">
            Delivery & Payment
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-stone-400 uppercase font-bold block text-[10px]">Dining Model</span>
              <p className="font-semibold text-charcoal-900 mt-0.5">
                {order.orderType === 'DINE_IN' && `Dine-In Table ${order.table?.tableNumber || 'Selected'}`}
                {order.orderType === 'PICKUP' && 'Takeaway / Self Pickup at Counter'}
                {order.orderType === 'DELIVERY' && `Doorstep Delivery`}
              </p>
            </div>

            {order.deliveryAddress && (
              <div>
                <span className="text-stone-400 uppercase font-bold block text-[10px]">Delivery Destination</span>
                <p className="text-stone-700 mt-0.5 leading-relaxed">{order.deliveryAddress}</p>
              </div>
            )}

            <div>
              <span className="text-stone-400 uppercase font-bold block text-[10px]">Payment Verification</span>
              <div className="mt-1 flex items-center space-x-2">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    order.payment?.status === 'SUCCESSFUL'
                      ? 'bg-emerald-100 text-emerald-800'
                      : order.payment?.status === 'REFUNDED'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {order.payment?.status || 'PENDING'}
                </span>
                <span className="text-stone-500 font-mono text-[11px]">
                  via {order.payment?.method || 'CASH'}
                </span>
              </div>
              {order.payment?.transactionRef && (
                <p className="font-mono text-[10px] text-stone-400 mt-1">
                  Ref: {order.payment.transactionRef}
                </p>
              )}
            </div>

            {order.notes && (
              <div>
                <span className="text-stone-400 uppercase font-bold block text-[10px]">Order Notes</span>
                <p className="text-stone-700 italic mt-0.5">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
