import { Schema, model } from 'mongoose';
import { Role } from './enums';
import { toJSONOptions } from './shared';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Excluded from queries by default; login selects it explicitly
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: null },
    role: { type: String, enum: Object.values(Role), default: Role.CUSTOMER, required: true },
  },
  { collection: 'users', timestamps: true, toJSON: toJSONOptions }
);

userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

export const User = model('User', userSchema);
