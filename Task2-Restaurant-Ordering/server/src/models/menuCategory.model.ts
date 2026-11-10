import { Schema, model } from 'mongoose';
import { toJSONOptions } from './shared';

const menuCategorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { collection: 'menuCategories', timestamps: true, toJSON: toJSONOptions }
);

menuCategorySchema.index({ sortOrder: 1 });

export const MenuCategory = model('MenuCategory', menuCategorySchema);
