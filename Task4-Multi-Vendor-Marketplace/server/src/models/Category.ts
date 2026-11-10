import { model, Schema, type InferSchemaType } from 'mongoose';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    image: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false },
);

// Case-insensitive uniqueness: "Books" and "books" are the same category.
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
categorySchema.index({ isActive: 1 });

export type CategoryRaw = InferSchemaType<typeof categorySchema>;
export const Category = model('Category', categorySchema);
