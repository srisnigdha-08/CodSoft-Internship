import { Schema, model } from 'mongoose';
import { OrderStatus, OrderType } from './enums';
import { randomObjectId, toJSONOptions } from './shared';

// Line items are read and written only with their order, so they are embedded.
// name and price are snapshots: later menu changes never alter past orders.
const orderItemSchema = new Schema(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', default: null },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    notes: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: toJSONOptions }
);

orderItemSchema.virtual('menuItem', {
  ref: 'MenuItem',
  localField: 'menuItemId',
  foreignField: '_id',
  justOne: true,
});

orderItemSchema.virtual('orderId').get(function () {
  return (this as any).ownerDocument()?.id;
});

const orderSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, default: randomObjectId },
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },
    customerPhone: { type: String, required: true },
    orderType: { type: String, enum: Object.values(OrderType), default: OrderType.DINE_IN, required: true },
    tableId: { type: Schema.Types.ObjectId, ref: 'RestaurantTable', default: null },
    deliveryAddress: { type: String, default: null },
    status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDING, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: null },
    items: {
      type: [orderItemSchema],
      validate: [(items: unknown[]) => items.length > 0, 'An order must contain at least one item'],
    },
  },
  { collection: 'orders', timestamps: true, toJSON: toJSONOptions }
);

orderSchema.virtual('table', {
  ref: 'RestaurantTable',
  localField: 'tableId',
  foreignField: '_id',
  justOne: true,
});

orderSchema.virtual('payment', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'orderId',
  justOne: true,
});

orderSchema.virtual('statusHistory', {
  ref: 'OrderStatusHistory',
  localField: '_id',
  foreignField: 'orderId',
});

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderType: 1 });
orderSchema.index({ tableId: 1, status: 1 });
orderSchema.index({ 'items.menuItemId': 1 });

export const Order = model('Order', orderSchema);
