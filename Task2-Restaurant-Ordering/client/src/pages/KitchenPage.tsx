import React, { useEffect, useState } from 'react';
import { Order, OrderStatus } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ChefHat,
  Clock,
  CheckCircle,
  AlertCircle,
  Flame,
  ArrowRight,
  RefreshCw,
  Utensils,
  Bike,
  Sparkles,
  Volume2,
} from 'lucide-react';

interface KitchenPageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const KitchenPage: React.FC<KitchenPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  async function loadKitchenFeed() {
    try {
      const activeOrders = await api.getKitchenOrders();
      setOrders(activeOrders);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Kitchen feed poll failed:', err);
    } finally {
      setLoading(false);
    }
  }

  // Poll kitchen orders every 4 seconds
  useEffect(() => {
    loadKitchenFeed();
    const interval = setInterval(loadKitchenFeed, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleAdvanceStatus = async (orderId: string, targetStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await api.updateOrderStatus(orderId, targetStatus);
      await loadKitchenFeed();
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED');
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');
  const readyOrders = orders.filter((o) => o.status === 'READY');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cream-200">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-600/20">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900">
                Kitchen Display System (KDS)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                Active Stations
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Real-time PostgreSQL kitchen queue • Auto-refreshes every 4 seconds
            </p>
          </div>
        </div>

        {/* Poller Info & Actions */}
        <div className="flex items-center space-x-3 self-end sm:self-center">
          <div className="flex items-center space-x-1.5 text-xs text-stone-500 bg-white px-3 py-1.5 rounded-full border border-cream-200 shadow-xs">
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>Updated {lastRefreshed.toLocaleTimeString()}</span>
          </div>

          <button
            onClick={() => loadKitchenFeed()}
            className="px-3.5 py-1.5 rounded-full bg-cream-200 hover:bg-cream-300 text-charcoal-800 text-xs font-bold transition-colors"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Role Notice if not logged in as staff */}
      {(!user || (user.role !== 'KITCHEN_STAFF' && user.role !== 'ADMIN')) && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
          <span>
            Previewing Kitchen Dashboard as guest/customer. To perform official status advancements, sign in with staff credentials.
          </span>
          <button
            onClick={() => onNavigate('login')}
            className="px-3 py-1 rounded-full bg-amber-600 text-white font-bold hover:bg-amber-700 ml-4 flex-shrink-0"
          >
            Staff Login
          </button>
        </div>
      )}

      {/* Kanban Board 3 Columns: Incoming -> In Prep -> Ready */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Incoming / Confirmed Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-3 py-2 bg-stone-100 rounded-2xl border border-stone-200">
            <span className="text-xs font-bold uppercase tracking-wider text-charcoal-900 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Incoming Queue ({pendingOrders.length})</span>
            </span>
            <span className="text-[11px] text-stone-500 font-mono">FIFO</span>
          </div>

          <div className="space-y-4">
            {pendingOrders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-cream-300 text-xs text-stone-400">
                No incoming tickets waiting.
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl p-5 border-2 border-blue-200/80 shadow-md space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-display text-base font-bold text-charcoal-900">
                        {order.orderNumber}
                      </span>
                      <p className="text-[11px] text-stone-500">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
                      {order.orderType === 'DINE_IN' ? `Table ${order.table?.tableNumber || '-'}` : order.orderType}
                    </span>
                  </div>

                  {/* Order Items List */}
                  <div className="p-3 rounded-2xl bg-cream-50 border border-cream-200 space-y-2 text-xs">
                    {order.items.map((it) => (
                      <div key={it.id} className="flex justify-between items-start">
                        <span className="font-bold text-charcoal-900">
                          {it.quantity}x {it.name}
                        </span>
                        {it.notes && (
                          <span className="text-[10px] text-terracotta-700 italic ml-2">
                            "{it.notes}"
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200 italic">
                      Special Note: {order.notes}
                    </p>
                  )}

                  <div className="pt-2 border-t border-cream-100">
                    <button
                      onClick={() => handleAdvanceStatus(order.id, 'PREPARING')}
                      disabled={updatingId === order.id}
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Accept & Start Cooking</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: In Preparation */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-2xl border border-amber-200">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>In Preparation ({preparingOrders.length})</span>
            </span>
            <span className="text-[11px] text-amber-700 font-mono">Kitchen Fire</span>
          </div>

          <div className="space-y-4">
            {preparingOrders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-cream-300 text-xs text-stone-400">
                Kitchen stations idle.
              </div>
            ) : (
              preparingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl p-5 border-2 border-amber-300 shadow-md space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-display text-base font-bold text-charcoal-900">
                        {order.orderNumber}
                      </span>
                      <p className="text-[11px] text-stone-500">
                        Cooking since{' '}
                        {new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 uppercase">
                      {order.orderType === 'DINE_IN' ? `Table ${order.table?.tableNumber || '-'}` : order.orderType}
                    </span>
                  </div>

                  {/* Order Items List */}
                  <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-2 text-xs">
                    {order.items.map((it) => (
                      <div key={it.id} className="flex justify-between items-start">
                        <span className="font-bold text-charcoal-900">
                          {it.quantity}x {it.name}
                        </span>
                        {it.notes && (
                          <span className="text-[10px] text-terracotta-700 italic ml-2">
                            "{it.notes}"
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-cream-100">
                    <button
                      onClick={() => handleAdvanceStatus(order.id, 'READY')}
                      disabled={updatingId === order.id}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      <span>Mark Plated & Ready</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Ready for Pickup / Table Service */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-2xl border border-emerald-200">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>Ready for Service ({readyOrders.length})</span>
            </span>
            <span className="text-[11px] text-emerald-700 font-mono">Service Bell</span>
          </div>

          <div className="space-y-4">
            {readyOrders.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-cream-300 text-xs text-stone-400">
                No orders waiting on pass.
              </div>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl p-5 border-2 border-emerald-300 shadow-md space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-display text-base font-bold text-charcoal-900">
                        {order.orderNumber}
                      </span>
                      <p className="text-[11px] text-stone-500">
                        Ready at{' '}
                        {new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                      {order.orderType === 'DINE_IN' ? `Table ${order.table?.tableNumber || '-'}` : order.orderType}
                    </span>
                  </div>

                  {/* Order Items List */}
                  <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2 text-xs">
                    {order.items.map((it) => (
                      <div key={it.id} className="flex justify-between items-start">
                        <span className="font-bold text-charcoal-900">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold">READY</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-cream-100">
                    <button
                      onClick={() => handleAdvanceStatus(order.id, 'COMPLETED')}
                      disabled={updatingId === order.id}
                      className="w-full py-2.5 rounded-xl bg-charcoal-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Complete & Handover</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
