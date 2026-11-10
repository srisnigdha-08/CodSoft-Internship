import { Router, type Request } from 'express';
import type { SortOrder, Types } from 'mongoose';
import { z } from 'zod';
import {
  authenticate,
  currentUser,
  loadVendor,
  requireApprovedVendor,
  requireRole,
  currentVendor,
} from '../middleware/auth.js';
import { Category, Product, Review, User, Vendor } from '../models/index.js';
import type { ProductLean } from '../models/Product.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import {
  escapeRegex,
  imageUrlSchema,
  objectIdString,
  paginated,
  paginationQuery,
  parseId,
} from '../utils/validation.js';
import { findPublicProduct, publicProductScope, withCatalogRefs } from '../services/catalog.service.js';
import { findQualifyingOrder } from '../services/review.service.js';

const SORTS: Record<string, Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  rating: { rating: -1, reviewCount: -1, _id: 1 },
  name: { name: 1, _id: 1 },
};

const listQuery = paginationQuery
  .extend({
    q: z.string().trim().max(100).optional(),
    category: objectIdString.optional(),
    vendor: objectIdString.optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    inStock: z.enum(['true', 'false']).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating', 'name']).default('newest'),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'minPrice must not exceed maxPrice',
    path: ['minPrice'],
  });

const priceSchema = z
  .number()
  .positive()
  .max(10_000_000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: 'Price can have at most 2 decimal places',
  });

const productFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(4000),
  images: z.array(imageUrlSchema).max(8),
  price: priceSchema,
  sku: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9-]+$/, 'SKU can use letters, digits and dashes'),
  categoryId: objectIdString,
  isActive: z.boolean(),
};

const createProductSchema = z.object({
  ...productFields,
  images: productFields.images.default([]),
  isActive: productFields.isActive.default(true),
  stock: z.number().int().min(0).max(1_000_000),
});

// Stock is excluded: it only changes through the atomic /stock endpoint.
const updateProductSchema = z.object(productFields).partial();

const stockAdjustmentSchema = z.object({
  adjustment: z.number().int().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, {
    message: 'Adjustment cannot be zero',
  }),
});

async function assertActiveCategory(categoryId: string): Promise<void> {
  const exists = await Category.exists({ _id: categoryId, isActive: true });
  if (!exists) throw badRequest('Category does not exist or is inactive');
}

/** Admins may act on any product; vendors only on their own, and only while approved. */
async function authorizeProductWrite(req: Request, productId: Types.ObjectId) {
  const user = currentUser(req);
  const product = await Product.findById(productId);
  if (!product) throw notFound('Product');
  if (user.role === 'ADMIN') return product;

  const vendor = await Vendor.findOne({ userId: user._id }).lean();
  if (!vendor || !vendor._id.equals(product.vendorId)) {
    throw forbidden('You can only manage your own products');
  }
  if (vendor.approvalStatus !== 'APPROVED') {
    throw forbidden('Your store must be approved before it can manage products');
  }
  return product;
}

export const productsRouter = Router();

productsRouter.get('/', async (req, res) => {
  const query = listQuery.parse(req.query);
  const scope = await publicProductScope();

  const filter: Record<string, unknown> = { ...scope };
  const conditions: Record<string, unknown>[] = [];
  if (query.category) conditions.push({ categoryId: parseId(query.category) });
  if (query.vendor) conditions.push({ vendorId: parseId(query.vendor) });
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {
      ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
    };
  }
  if (query.inStock === 'true') filter.stock = { $gt: 0 };
  if (query.inStock === 'false') filter.stock = 0;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    conditions.push({ $or: [{ name: pattern }, { description: pattern }, { sku: pattern }] });
  }
  if (conditions.length > 0) filter.$and = conditions;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(SORTS[query.sort])
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<ProductLean[]>(),
    Product.countDocuments(filter),
  ]);
  res.json(paginated(await withCatalogRefs(products), total, query.page, query.limit));
});

productsRouter.get('/:id', async (req, res) => {
  const product = await findPublicProduct(parseId(req.params.id));
  if (!product) throw notFound('Product');
  const [view] = await withCatalogRefs([product]);
  res.json({ product: view });
});

productsRouter.get('/:id/reviews', async (req, res) => {
  const productId = parseId(req.params.id);
  const { page, limit } = paginationQuery.parse(req.query);
  const product = await findPublicProduct(productId);
  if (!product) throw notFound('Product');

  const [reviews, total] = await Promise.all([
    Review.find({ productId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments({ productId }),
  ]);
  const authors = await User.find({ _id: { $in: reviews.map((r) => r.userId) } })
    .select('name')
    .lean();
  const nameById = new Map(authors.map((author) => [author._id.toString(), author.name]));
  const items = reviews.map(({ orderId: _orderId, ...review }) => ({
    ...review,
    authorName: nameById.get(review.userId.toString()) ?? 'Customer',
  }));
  res.json(paginated(items, total, page, limit));
});

productsRouter.get(
  '/:id/review-eligibility',
  authenticate,
  requireRole('CUSTOMER'),
  async (req, res) => {
    const productId = parseId(req.params.id);
    const userId = currentUser(req)._id;
    const [order, existing] = await Promise.all([
      findQualifyingOrder(userId, productId),
      Review.exists({ productId, userId }),
    ]);
    res.json({ canReview: Boolean(order) && !existing, hasReviewed: Boolean(existing) });
  },
);

productsRouter.post(
  '/',
  authenticate,
  requireRole('VENDOR'),
  loadVendor,
  requireApprovedVendor,
  async (req, res) => {
    const input = createProductSchema.parse(req.body);
    await assertActiveCategory(input.categoryId);
    // vendorId comes from the session; any vendorId in the body is ignored.
    const product = await Product.create({ ...input, vendorId: currentVendor(req)._id });
    res.status(201).json({ product });
  },
);

productsRouter.patch('/:id', authenticate, requireRole('VENDOR', 'ADMIN'), async (req, res) => {
  const product = await authorizeProductWrite(req, parseId(req.params.id));
  const input = updateProductSchema.parse(req.body);
  if (input.categoryId) await assertActiveCategory(input.categoryId);
  product.set(input);
  await product.save();
  res.json({ product });
});

productsRouter.patch('/:id/stock', authenticate, requireRole('VENDOR', 'ADMIN'), async (req, res) => {
  const productId = parseId(req.params.id);
  await authorizeProductWrite(req, productId);
  const { adjustment } = stockAdjustmentSchema.parse(req.body);

  const product = await Product.findOneAndUpdate(
    { _id: productId, stock: { $gte: Math.max(0, -adjustment) } },
    { $inc: { stock: adjustment } },
    { returnDocument: 'after' },
  );
  if (!product) throw conflict('Stock cannot go below zero');
  res.json({ product });
});

// Soft delete: past orders and reviews keep referencing the product.
productsRouter.delete('/:id', authenticate, requireRole('VENDOR', 'ADMIN'), async (req, res) => {
  const product = await authorizeProductWrite(req, parseId(req.params.id));
  product.isActive = false;
  await product.save();
  res.status(204).end();
});
