import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RestaurantTable, Reservation } from '../types';
import {
  CalendarDays,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Utensils,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface ReservationsPageProps {
  onNavigate: (page: string, param?: string) => void;
}

const timeSlots = [
  '12:00', '12:30', '13:00', '13:30', '14:00',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

export const ReservationsPage: React.FC<ReservationsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState<string>(todayStr);
  const [time, setTime] = useState<string>('19:30');
  const [guestCount, setGuestCount] = useState<number>(2);
  const [tableId, setTableId] = useState<string>('');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '+91 98765 43212');
  const [specialRequests, setSpecialRequests] = useState('');

  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availableTables, setAvailableTables] = useState<RestaurantTable[]>([]);
  const [isSlotAvailable, setIsSlotAvailable] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.name);
      if (!customerEmail) setCustomerEmail(user.email);
      if (!customerPhone && user.phone) setCustomerPhone(user.phone);
    }
  }, [user]);

  // Check table availability whenever date, time, or guest count changes
  useEffect(() => {
    async function verifySlot() {
      if (!date || !time) return;
      setCheckingAvailability(true);
      setErrorMsg(null);
      try {
        const res = await api.checkAvailability({
          date,
          time,
          guestCount,
        });
        setIsSlotAvailable(res.available);
        setAvailableTables(res.availableTables);
        // If current selected table is no longer available in this slot, reset selection
        if (tableId && !res.availableTables.some((t) => t.id === tableId)) {
          setTableId('');
        }
      } catch (err: any) {
        console.error('Availability check failed:', err);
      } finally {
        setCheckingAvailability(false);
      }
    }

    verifySlot();
  }, [date, time, guestCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setErrorMsg('Please complete all guest contact fields.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.createReservation({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        customerPhone: customerPhone.trim(),
        guestCount,
        reservationDate: date,
        reservationTime: time,
        tableId: tableId || undefined,
        specialRequests: specialRequests.trim() || undefined,
      });

      setConfirmedReservation(res);
    } catch (err: any) {
      console.error('Reservation submission error:', err);
      setErrorMsg(err.message || 'Unable to confirm reservation. The table may have been booked concurrently.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Title & Introduction */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="px-3 py-1 rounded-full bg-terracotta-100 text-terracotta-800 text-xs font-bold uppercase tracking-wider inline-flex items-center space-x-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-terracotta-600" />
          <span>Real-Time Table Reservations</span>
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-charcoal-900">
          Reserve Your Dining Experience
        </h1>
        <p className="text-sm text-stone-600 leading-relaxed">
          Select your desired date, dining time, and guest count. Our concurrency-controlled booking engine reserves your table instantly in PostgreSQL.
        </p>
      </div>

      {confirmedReservation ? (
        /* Confirmation State */
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-cream-200 shadow-xl max-w-xl mx-auto text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              Reservation Confirmed
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900">
              We Look Forward to Welcoming You
            </h2>
            <p className="font-mono text-sm font-bold text-terracotta-700">
              Reference #{confirmedReservation.reservationNumber}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-cream-50 border border-cream-200 text-left space-y-2.5 text-xs text-stone-700">
            <div className="flex justify-between">
              <span className="text-stone-500">Guest Name:</span>
              <span className="font-bold text-charcoal-900">{confirmedReservation.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Date & Time:</span>
              <span className="font-bold text-charcoal-900">
                {confirmedReservation.reservationDate} at {confirmedReservation.reservationTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Party Size:</span>
              <span className="font-bold text-charcoal-900">{confirmedReservation.guestCount} Guests</span>
            </div>
            {confirmedReservation.table && (
              <div className="flex justify-between">
                <span className="text-stone-500">Allocated Table:</span>
                <span className="font-bold text-terracotta-700">
                  {confirmedReservation.table.tableNumber} ({confirmedReservation.table.locationDescription})
                </span>
              </div>
            )}
            {confirmedReservation.specialRequests && (
              <div className="pt-2 border-t border-cream-200">
                <span className="text-stone-500 block mb-0.5">Special Requests:</span>
                <p className="italic text-stone-800 font-medium">"{confirmedReservation.specialRequests}"</p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('reservations')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-terracotta-700 hover:bg-terracotta-800 text-white font-bold text-xs shadow-md transition-all"
            >
              View My Reservations
            </button>
            <button
              onClick={() => {
                setConfirmedReservation(null);
                setSpecialRequests('');
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-white hover:bg-cream-100 text-charcoal-900 border border-cream-300 font-bold text-xs"
            >
              Book Another Table
            </button>
          </div>
        </div>
      ) : (
        /* Booking Form */
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Date, Time & Party Selection */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-cream-200 shadow-sm space-y-6">
            <h3 className="font-display text-xl font-bold text-charcoal-900 pb-3 border-b border-cream-100">
              1. Date, Time & Party Size
            </h3>

            {/* Date and Guests */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                  Dining Date
                </label>
                <div className="relative">
                  <CalendarDays className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-cream-300 text-sm font-semibold text-charcoal-900 focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                  Number of Guests
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(parseInt(e.target.value, 10))}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-cream-300 text-sm font-semibold text-charcoal-900 focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((num) => (
                      <option key={num} value={num}>
                        {num} Guest{num > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Time Slot Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider">
                  Available Time Slots
                </label>
                {checkingAvailability && (
                  <span className="text-[11px] text-terracotta-700 flex items-center space-x-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Checking live availability...</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      time === slot
                        ? 'bg-terracotta-700 text-white shadow-sm ring-2 ring-terracotta-300'
                        : 'bg-cream-100 hover:bg-cream-200 text-charcoal-800'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Allocation Preference */}
            <div>
              <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                Table Seating Preference
              </label>

              {availableTables.length > 0 ? (
                <select
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-cream-300 text-sm font-semibold text-charcoal-900 focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
                >
                  <option value="">Smart Auto-Allocate Best Matching Table</option>
                  {availableTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tableNumber} (Capacity: {t.capacity} guests) — {t.locationDescription || 'Dining Area'}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>All tables for this time slot are fully committed. Please try another time.</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Guest Information & Confirmation */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-cream-200 shadow-sm space-y-6">
            <h3 className="font-display text-xl font-bold text-charcoal-900 pb-3 border-b border-cream-100">
              2. Guest Details
            </h3>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-3.5">
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
                  Contact Phone *
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

              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">
                  Special Requests / Occasion
                </label>
                <textarea
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="e.g. Anniversary celebration, quiet booth preferred, wheelchair accessible..."
                  className="w-full px-4 py-2 rounded-xl border border-cream-300 text-sm focus:ring-2 focus:ring-terracotta-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !isSlotAvailable}
              className="w-full py-3.5 rounded-full bg-terracotta-700 hover:bg-terracotta-800 disabled:bg-stone-300 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-terracotta-700/20 transition-all active:scale-98"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Securing Table...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Reservation</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center space-x-1.5 text-[11px] text-stone-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Instant Confirmation • No Booking Fees</span>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
