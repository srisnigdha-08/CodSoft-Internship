import { Schema, model } from 'mongoose';
import { toJSONOptions } from './shared';

const restaurantTableSchema = new Schema(
  {
    tableNumber: { type: String, required: true, unique: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    locationDescription: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { collection: 'restaurantTables', timestamps: true, toJSON: toJSONOptions }
);

restaurantTableSchema.index({ isActive: 1, capacity: 1 });

export const RestaurantTable = model('RestaurantTable', restaurantTableSchema);
