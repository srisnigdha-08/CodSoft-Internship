import { Schema, model } from 'mongoose';
import { toJSONOptions } from './shared';

const menuItemSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'MenuCategory', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    // Stored in rupees and rounded to two decimal places by the API
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true },
    isVegetarian: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    preparationTimeMinutes: { type: Number, default: 15, min: 1 },
    sortOrder: { type: Number, default: 0 },
  },
  { collection: 'menuItems', timestamps: true, toJSON: toJSONOptions }
);

menuItemSchema.virtual('category', {
  ref: 'MenuCategory',
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true,
});

menuItemSchema.index({ categoryId: 1, sortOrder: 1, name: 1 });
menuItemSchema.index({ isVegetarian: 1 });
menuItemSchema.index({ isAvailable: 1 });
menuItemSchema.index({ name: 1 });
menuItemSchema.index({ sortOrder: 1, name: 1 });

export const MenuItem = model('MenuItem', menuItemSchema);
