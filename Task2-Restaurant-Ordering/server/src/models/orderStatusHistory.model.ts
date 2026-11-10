import { Schema, model } from 'mongoose';
import { OrderStatus } from './enums';
import { toJSONOptions } from './shared';

// Append-only audit trail, one document per status change
const orderStatusHistorySchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    previousStatus: { type: String, enum: [...Object.values(OrderStatus), null], default: null },
    newStatus: { type: String, enum: Object.values(OrderStatus), required: true },
    changedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: null },
  },
  { collection: 'orderStatusHistory', timestamps: { createdAt: true, updatedAt: false }, toJSON: toJSONOptions }
);

orderStatusHistorySchema.virtual('changedBy', {
  ref: 'User',
  localField: 'changedByUserId',
  foreignField: '_id',
  justOne: true,
});

orderStatusHistorySchema.index({ orderId: 1, createdAt: 1 });

export const OrderStatusHistory = model('OrderStatusHistory', orderStatusHistorySchema);
