import React, { useEffect, useState } from 'react';
import { Reservation } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CalendarDays,
  Clock,
  Users,
  Utensils,
  ChevronRight,
  AlertCircle,
  XCircle,
} from 'lucide-react';

interface MyReservationsPageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const MyReservationsPage: React.FC<MyReservationsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const list = await api.getMyReservations(user?.email || undefined);
        setReservations(list);
      } catch (err) {
        console.error('Failed to load reservations', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const handleCancel = async (id: string) => {
    const confirm = window.confirm('Are you sure you wish to cancel this reservation?');
    if (!confirm) return;

    try {
      const updated = await api.updateReservationStatus(id, 'CANCELLED');
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'CANCELLED' } : r))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to cancel reservation');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cream-200">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal-900">
            My Table Reservations
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Review your upcoming bookings and table dining confirmations
          </p>
        </div>

        <button
          onClick={() => onNavigate('reserve')}
          className="px-5 py-2.5 rounded-full bg-terracotta-700 hover:bg-terracotta-800 text-white font-bold text-xs shadow-sm self-start sm:self-center"
        >
          Book Another Table
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="bg-white rounded-3xl h-32 border border-cream-200 animate-pulse" />
          ))}
        </div>
      ) : reservations.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-cream-200 max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-cream-100 text-stone-400 mx-auto flex items-center justify-center">
            <CalendarDays className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-bold text-charcoal-900">No Reservations Yet</h3>
          <p className="text-xs text-stone-500">
            You don't have any table reservations registered. Book a cozy table for your next occasion.
          </p>
          <button
            onClick={() => onNavigate('reserve')}
            className="px-5 py-2.5 rounded-full bg-terracotta-700 text-white text-xs font-bold"
          >
            Reserve Table
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((res) => {
            const isConfirmed = res.status === 'CONFIRMED';
            const isCancelled = res.status === 'CANCELLED';

            return (
              <div
                key={res.id}
                className="bg-white rounded-3xl p-6 border border-cream-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-display text-lg font-bold text-charcoal-900">
                      #{res.reservationNumber}
                    </span>
                    <span
                      className={`px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                        isConfirmed
                          ? 'bg-emerald-100 text-emerald-800'
                          : isCancelled
                          ? 'bg-red-100 text-red-700'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {res.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
                    <span className="flex items-center space-x-1.5 font-semibold text-charcoal-900">
                      <CalendarDays className="w-3.5 h-3.5 text-terracotta-600" />
                      <span>{res.reservationDate}</span>
                    </span>
                    <span className="flex items-center space-x-1.5 font-semibold text-charcoal-900">
                      <Clock className="w-3.5 h-3.5 text-terracotta-600" />
                      <span>{res.reservationTime}</span>
                    </span>
                    <span className="flex items-center space-x-1.5 font-semibold text-charcoal-900">
                      <Users className="w-3.5 h-3.5 text-terracotta-600" />
                      <span>{res.guestCount} Guests</span>
                    </span>
                    {res.table && (
                      <span className="flex items-center space-x-1.5 font-semibold text-terracotta-700 bg-cream-100 px-2 py-0.5 rounded-md">
                        <Utensils className="w-3.5 h-3.5" />
                        <span>Table {res.table.tableNumber} ({res.table.locationDescription})</span>
                      </span>
                    )}
                  </div>

                  {res.specialRequests && (
                    <p className="text-xs text-stone-500 italic mt-1">
                      Special Requests: "{res.specialRequests}"
                    </p>
                  )}
                </div>

                {isConfirmed && (
                  <div>
                    <button
                      onClick={() => handleCancel(res.id)}
                      className="px-4 py-2 rounded-full border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
                    >
                      Cancel Booking
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
