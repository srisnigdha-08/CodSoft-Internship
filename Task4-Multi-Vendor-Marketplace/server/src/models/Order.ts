import { model, Schema, type InferSchemaType, type Types } from 'mongoose';
import { PAYMENT_STATUSES, STATUS_ACTORS, VENDOR_ORDER_STATUSES } from './constants.js';
import { addressSubSchema } from './Vendor.js';

const moneyField = { type: Number, required: true, min: 0 } as const;

// Price, name and SKU are snapshots: later catalog edits must not rewrite history.
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    image: { type: String },
    unitPrice: moneyField,
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: moneyField,
  },
  { _id: false },
);

const statusEventSchema = new Schema(
  {
    status: { type: String, enum: VENDOR_ORDER_STATUSES, required: true },
    actor: { type: String, enum: STATUS_ACTORS, required: true },
    at: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const vendorOrderSchema = new Schema({
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  vendorName: { type: String, required: true },
  items: {
    type: [orderItemSchema],
    validate: { validator: (v: unknown[]) => v.length > 0, message: 'A vendor order needs items' },
  },
  subtotal: moneyField,
  tax: moneyField,
  deliveryFee: moneyField,
  total: moneyField,
  status: { type: String, enum: VENDOR_ORDER_STATUSES, required: true, default: 'PENDING' },
  statusHistory: { type: [statusEventSchema], default: [] },
});

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contact: {
      type: new Schema(
        {
          fullName: { type: String, required: true, trim: true, maxlength: 80 },
          email: { type: String, required: true, trim: true, lowercase: true },
          phone: { type: String, required: true, trim: true, maxlength: 20 },
        },
        { _id: false },
      ),
      required: true,
    },
    shippingAddress: { type: addressSubSchema, required: true },
    vendorOrders: {
      type: [vendorOrderSchema],
      validate: { validator: (v: unknown[]) => v.length > 0, message: 'An order needs vendors' },
    },
    subtotal: moneyField,
    tax: moneyField,
    deliveryFee: moneyField,
    grandTotal: moneyField,
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'PENDING' },
  },
  { timestamps: true, versionKey: false },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ 'vendorOrders.vendorId': 1, createdAt: -1 });
orderSchema.index({ 'vendorOrders.items.productId': 1, customerId: 1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

export type OrderRaw = InferSchemaType<typeof orderSchema>;
export type OrderLean = OrderRaw & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export type VendorOrderLean = OrderLean['vendorOrders'][number] & { _id: Types.ObjectId };
export const Order = model('Order', orderSchema);
