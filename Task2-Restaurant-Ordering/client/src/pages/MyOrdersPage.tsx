import React, { useEffect, useState } from 'react';
import { Order } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Calendar,
  Utensils,
} from 'lucide-react';

interface MyOrdersPageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const MyOrdersPage: React.FC<MyOrdersPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      try {
        const list = await api.getMyOrders(user?.email || undefined);
        setOrders(list);
      } catch (err) {
        console.error('Failed to load orders', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [user]);

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ACTIVE') {
      return ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status);
    }
    if (filter === 'COMPLETED') {
      return o.status === 'COMPLETED';
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cream-200">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal-900">
            Order History
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Track active dining orders or review your previous culinary receipts
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 bg-cream-200 p-1 rounded-full text-xs self-start sm:self-center">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-full font-bold transition-all ${
              filter === 'ALL' ? 'bg-white text-charcoal-900 shadow-xs' : 'text-stone-600 hover:text-charcoal-900'
            }`}
          >
            All ({orders.length})
          </button>
          <button
            onClick={() => setFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-full font-bold transition-all ${
              filter === 'ACTIVE' ? 'bg-white text-charcoal-900 shadow-xs' : 'text-stone-600 hover:text-charcoal-900'
            }`}
          >
            Active Orders
          </button>
          <button
            onClick={() => setFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-full font-bold transition-all ${
              filter === 'COMPLETED' ? 'bg-white text-charcoal-900 shadow-xs' : 'text-stone-600 hover:text-charcoal-900'
            }`}
          >
            Past Orders
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-3xl h-36 border border-cream-200 animate-pulse" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-cream-200 max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-cream-100 text-stone-400 mx-auto flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-bold text-charcoal-900">No Orders Found</h3>
          <p className="text-xs text-stone-500">
            {filter === 'ALL'
              ? 'You have not placed any orders yet. Indulge in our artisanal dishes.'
              : `No orders matching filter "${filter}".`}
          </p>
          <button
            onClick={() => onNavigate('menu')}
            className="px-5 py-2.5 rounded-full bg-terracotta-700 text-white text-xs font-bold"
          >
            Explore Menu
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isFinished = order.status === 'COMPLETED';
            const isCancelled = order.status === 'CANCELLED';

            return (
              <div
                key={order.id}
                onClick={() => onNavigate('order-detail', order.id)}
                className="group cursor-pointer bg-white rounded-3xl p-6 border border-cream-200 hover:border-terracotta-300 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Order Information */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-display text-lg font-bold text-charcoal-900 group-hover:text-terracotta-700 transition-colors">
                      {order.orderNumber}
                    </span>
                    <span
                      className={`px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                        isCancelled
                          ? 'bg-red-100 text-red-700'
                          : isFinished
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900 animate-pulse'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <p className="text-xs text-stone-500 flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    </span>
                    <span>•</span>
                    <span>{order.orderType.replace('_', ' ')}</span>
                    {order.table && (
                      <>
                        <span>•</span>
                        <span>Table {order.table.tableNumber}</span>
                      </>
                    )}
                  </p>

                  {/* Items summary */}
                  <div className="text-xs text-stone-700 line-clamp-1">
                    {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </div>
                </div>

                {/* Right side: Amount and View Button */}
                <div className="flex items-center justify-between md:justify-end space-x-6 pt-3 md:pt-0 border-t md:border-t-0 border-cream-100">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-stone-500 uppercase font-medium block">Total Paid</span>
                    <span className="font-display text-lg font-bold text-charcoal-900">
                      ₹{Number(order.totalAmount).toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate('order-detail', order.id);
                    }}
                    className="px-4 py-2 rounded-full bg-cream-100 group-hover:bg-terracotta-700 text-charcoal-900 group-hover:text-white text-xs font-bold transition-all flex items-center space-x-1"
                  >
                    <span>Track Live</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
