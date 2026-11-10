import { model, Schema, type InferSchemaType } from 'mongoose';

export const MAX_LINE_QUANTITY = 99;

const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    quantity: { type: Number, required: true, min: 1, max: MAX_LINE_QUANTITY },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

cartSchema.index({ customerId: 1 }, { unique: true });

export type CartRaw = InferSchemaType<typeof cartSchema>;
export const Cart = model('Cart', cartSchema);
