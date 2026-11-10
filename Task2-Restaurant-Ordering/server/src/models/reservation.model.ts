import { Schema, model } from 'mongoose';
import { ReservationStatus } from './enums';
import { toJSONOptions } from './shared';

const ACTIVE_STATUSES: string[] = [ReservationStatus.PENDING, ReservationStatus.CONFIRMED];

export const RESERVATION_SLOT_INDEX = 'reservations_active_table_slot';

const reservationSchema = new Schema(
  {
    reservationNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },
    customerPhone: { type: String, required: true },
    tableId: { type: Schema.Types.ObjectId, ref: 'RestaurantTable', default: null },
    guestCount: { type: Number, required: true, min: 1, max: 20 },
    reservationDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    reservationTime: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
    status: { type: String, enum: Object.values(ReservationStatus), default: ReservationStatus.PENDING, required: true },
    specialRequests: { type: String, default: null },
    // True while this reservation occupies its table and slot. Backs the partial unique index below.
    holdsSlot: { type: Boolean, default: false },
  },
  { collection: 'reservations', timestamps: true, toJSON: toJSONOptions }
);

reservationSchema.pre<any>('validate', function (next) {
  this.holdsSlot = Boolean(this.tableId) && ACTIVE_STATUSES.includes(this.status);
  next();
});

reservationSchema.virtual('table', {
  ref: 'RestaurantTable',
  localField: 'tableId',
  foreignField: '_id',
  justOne: true,
});

reservationSchema.virtual('customer', {
  ref: 'User',
  localField: 'customerId',
  foreignField: '_id',
  justOne: true,
});

// Database-level double-booking guard: one active reservation per table, date and exact time.
// It holds on standalone servers and replica sets alike. There is no duration or overlap rule.
reservationSchema.index(
  { tableId: 1, reservationDate: 1, reservationTime: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true }, name: RESERVATION_SLOT_INDEX }
);
reservationSchema.index({ customerId: 1, reservationDate: -1, reservationTime: -1 });
reservationSchema.index({ reservationDate: 1, reservationTime: 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ tableId: 1, status: 1 });

export const Reservation = model('Reservation', reservationSchema);
