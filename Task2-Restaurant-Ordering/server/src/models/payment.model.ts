import { Schema, model } from 'mongoose';
import { PaymentMethod, PaymentStatus } from './enums';
import { randomObjectId, toJSONOptions } from './shared';

// Payments are simulated. No gateway is connected and card details are never collected or stored.
const paymentSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, default: randomObjectId },
    paymentNumber: { type: String, required: true, unique: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: Object.values(PaymentMethod), default: PaymentMethod.MOCK_ONLINE, required: true },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING, required: true },
    transactionRef: { type: String, default: null },
    gatewayResponse: { type: String, default: null },
  },
  { collection: 'payments', timestamps: true, toJSON: toJSONOptions }
);

paymentSchema.virtual('order', {
  ref: 'Order',
  localField: 'orderId',
  foreignField: '_id',
  justOne: true,
});

paymentSchema.index({ customerId: 1 });

export const Payment = model('Payment', paymentSchema);
