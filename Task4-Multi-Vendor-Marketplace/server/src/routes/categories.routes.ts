import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { Category } from '../models/index.js';
import { notFound } from '../utils/AppError.js';
import { imageUrlSchema, parseId } from '../utils/validation.js';

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).default(''),
  image: imageUrlSchema.optional(),
  isActive: z.boolean().default(true),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(500).optional(),
  image: imageUrlSchema.optional(),
  isActive: z.boolean().optional(),
});

export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res) => {
  const items = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
  res.json({ items });
});

categoriesRouter.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const category = await Category.create(createCategorySchema.parse(req.body));
  res.status(201).json({ category });
});

categoriesRouter.patch('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const category = await Category.findByIdAndUpdate(
    parseId(req.params.id),
    { $set: updateCategorySchema.parse(req.body) },
    { returnDocument: 'after', runValidators: true },
  );
  if (!category) throw notFound('Category');
  res.json({ category });
});
