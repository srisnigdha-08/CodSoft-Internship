import { model, Schema, type InferSchemaType } from 'mongoose';
import { VENDOR_APPROVAL_STATUSES } from './constants.js';

export const addressSubSchema = new Schema(
  {
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60 },
    postalCode: { type: String, required: true, trim: true, maxlength: 12 },
    country: { type: String, required: true, trim: true, maxlength: 60, default: 'India' },
  },
  { _id: false },
);

const vendorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    businessName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    logo: { type: String, trim: true, maxlength: 500 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    address: { type: addressSubSchema, required: true },
    approvalStatus: {
      type: String,
      enum: VENDOR_APPROVAL_STATUSES,
      required: true,
      default: 'PENDING',
    },
    approvalNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false },
);

vendorSchema.index({ userId: 1 }, { unique: true });
vendorSchema.index(
  { businessName: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
vendorSchema.index({ approvalStatus: 1, createdAt: -1 });

export type VendorRaw = InferSchemaType<typeof vendorSchema>;
export const Vendor = model('Vendor', vendorSchema);
