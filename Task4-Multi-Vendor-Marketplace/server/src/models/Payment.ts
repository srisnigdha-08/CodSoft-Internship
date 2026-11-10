import { model, Schema, type InferSchemaType } from 'mongoose';
import { PAYMENT_STATUSES, SIMULATED_PAYMENT_METHOD } from './constants.js';
import { CURRENCY } from '../config/pricing.js';

// Only simulated payments exist. No card or bank data is accepted or stored.
const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    refundedAmount: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, required: true, default: CURRENCY },
    method: {
      type: String,
      enum: [SIMULATED_PAYMENT_METHOD],
      required: true,
      default: SIMULATED_PAYMENT_METHOD,
    },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'PENDING' },
    reference: { type: String, trim: true },
    failureReason: { type: String, trim: true, maxlength: 300 },
    processedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

paymentSchema.index({ orderId: 1 }, { unique: true });
paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

export type PaymentRaw = InferSchemaType<typeof paymentSchema>;
export const Payment = model('Payment', paymentSchema);
