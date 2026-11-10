import { model, Schema, type InferSchemaType } from 'mongoose';

const reviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: 'Rating must be a whole number' },
    },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, required: true, trim: true, minlength: 3, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false },
);

// Business rule: one review per customer per product.
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });

export type ReviewRaw = InferSchemaType<typeof reviewSchema>;
export const Review = model('Review', reviewSchema);
