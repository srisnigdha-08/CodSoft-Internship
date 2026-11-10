import { model, Schema, type InferSchemaType } from 'mongoose';
import { ROLES, USER_STATUSES } from './constants.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'CUSTOMER' },
    phone: { type: String, trim: true, maxlength: 20 },
    status: { type: String, enum: USER_STATUSES, required: true, default: 'ACTIVE' },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });

export type UserRaw = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
