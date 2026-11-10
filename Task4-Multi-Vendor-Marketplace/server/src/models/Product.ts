import { model, Schema, type InferSchemaType, type Types } from 'mongoose';

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const productSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 4000 },
    images: { type: [String], default: [] },
    price: {
      type: Number,
      required: true,
      min: 0.01,
      max: 10_000_000,
      validate: { validator: hasAtMostTwoDecimals, message: 'Price can have at most 2 decimal places' },
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Stock must be a whole number' },
    },
    sku: { type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 40 },
    isActive: { type: Boolean, required: true, default: true },
    rating: { type: Number, required: true, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

productSchema.index({ vendorId: 1, sku: 1 }, { unique: true });
productSchema.index({ vendorId: 1, isActive: 1 });
productSchema.index({ categoryId: 1, isActive: 1, price: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, rating: -1 });
productSchema.index({ name: 1 });
productSchema.index({ sku: 1 });

export type ProductRaw = InferSchemaType<typeof productSchema>;
export type ProductLean = ProductRaw & { _id: Types.ObjectId };
export const Product = model('Product', productSchema);
