import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentUser, requireRole } from '../middleware/auth.js';
import { Product, Review } from '../models/index.js';
import { conflict, forbidden, notFound } from '../utils/AppError.js';
import { objectIdString, parseId } from '../utils/validation.js';
import { findQualifyingOrder, recalculateProductRating } from '../services/review.service.js';

const createReviewSchema = z.object({
  productId: objectIdString,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(3).max(2000),
});

export const reviewsRouter = Router();

reviewsRouter.use(authenticate);

reviewsRouter.post('/', requireRole('CUSTOMER'), async (req, res) => {
  const user = currentUser(req);
  const input = createReviewSchema.parse(req.body);
  const productId = parseId(input.productId, 'product id');

  const order = await findQualifyingOrder(user._id, productId);
  if (!order) throw forbidden('You can only review products you have received');

  let review;
  try {
    review = await Review.create({
      productId,
      userId: user._id,
      orderId: order._id,
      rating: input.rating,
      title: input.title,
      comment: input.comment,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw conflict('You have already reviewed this product');
    }
    throw error;
  }
  await recalculateProductRating(productId);
  res.status(201).json({ review });
});

reviewsRouter.get('/mine', requireRole('CUSTOMER'), async (req, res) => {
  const reviews = await Review.find({ userId: currentUser(req)._id }).sort({ createdAt: -1 }).lean();
  const products = await Product.find({ _id: { $in: reviews.map((r) => r.productId) } })
    .select('name')
    .lean();
  const nameById = new Map(products.map((p) => [p._id.toString(), p.name]));
  res.json({
    items: reviews.map((review) => ({
      ...review,
      productName: nameById.get(review.productId.toString()) ?? 'Removed product',
    })),
  });
});

reviewsRouter.delete('/:id', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  const user = currentUser(req);
  const review = await Review.findById(parseId(req.params.id));
  if (!review) throw notFound('Review');
  if (user.role !== 'ADMIN' && !review.userId.equals(user._id)) {
    throw forbidden('You can only delete your own reviews');
  }
  await review.deleteOne();
  await recalculateProductRating(review.productId);
  res.status(204).end();
});
