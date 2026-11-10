import type { Types } from 'mongoose';
import { Order, Product, Review } from '../models/index.js';

/** A customer may review a product once they have received it in a paid order. */
export async function findQualifyingOrder(userId: Types.ObjectId, productId: Types.ObjectId) {
  return Order.findOne({
    customerId: userId,
    paymentStatus: 'PAID',
    vendorOrders: { $elemMatch: { status: 'DELIVERED', 'items.productId': productId } },
  })
    .select('_id')
    .lean();
}

export async function recalculateProductRating(productId: Types.ObjectId): Promise<void> {
  const [summary] = await Review.aggregate<{ average: number; count: number }>([
    { $match: { productId } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        rating: summary ? Math.round(summary.average * 10) / 10 : 0,
        reviewCount: summary?.count ?? 0,
      },
    },
  );
}
