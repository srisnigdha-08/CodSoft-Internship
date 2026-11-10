import bcrypt from 'bcrypt';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { Category, Order, Payment, Product, Review, User, Vendor, allModels } from '../models/index.js';
import type { Role } from '../models/constants.js';
import { lineTotal, priceVendorLines, sumVendorTotals } from '../utils/money.js';
import { recalculateProductRating } from '../services/review.service.js';
import {
  DEMO_PASSWORDS,
  seedAdmin,
  seedCatalogImage,
  seedCategories,
  seedCustomers,
  seedOrders,
  seedProducts,
  seedReviews,
  seedVendors,
} from './data.js';

/**
 * Every write is an upsert on a natural key with $setOnInsert, so running the
 * seed repeatedly creates nothing new and never overwrites development changes.
 * Nothing is ever deleted.
 */
async function upsertUser(
  account: { name: string; email: string; phone: string },
  role: Role,
): Promise<Types.ObjectId> {
  const existing = await User.findOne({ email: account.email }).select('_id').lean();
  if (existing) return existing._id;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORDS[role], env.BCRYPT_ROUNDS);
  const user = await User.create({ ...account, passwordHash, role });
  return user._id;
}

async function upsertBy<T extends { _id: Types.ObjectId }>(
  // Each call site supplies a concrete Mongoose model.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  key: Record<string, unknown>,
  values: Record<string, unknown>,
  options: { timestamps?: boolean } = {},
): Promise<T> {
  return model.findOneAndUpdate(key, { $setOnInsert: values }, { upsert: true, returnDocument: 'after', ...options });
}

export interface SeedSummary {
  users: number;
  vendors: number;
  categories: number;
  products: number;
  orders: number;
  payments: number;
  reviews: number;
}

export async function runSeed(): Promise<SeedSummary> {
  await Promise.all(allModels.map((model) => model.init()));

  await upsertUser(seedAdmin, 'ADMIN');
  const customerIds = new Map<string, Types.ObjectId>();
  for (const customer of seedCustomers) {
    customerIds.set(customer.email, await upsertUser(customer, 'CUSTOMER'));
  }

  const categoryIds = new Map<string, Types.ObjectId>();
  for (const { name, ...rest } of seedCategories) {
    const category = await upsertBy(Category, { name }, rest);
    categoryIds.set(name, category._id);
  }

  const vendors = new Map<string, { _id: Types.ObjectId; businessName: string }>();
  for (const { key, owner, ...rest } of seedVendors) {
    const userId = await upsertUser(owner, 'VENDOR');
    const vendor = await upsertBy<{ _id: Types.ObjectId; businessName: string }>(
      Vendor,
      { userId },
      { ...rest, contactEmail: owner.email, phone: owner.phone },
    );
    vendors.set(key, vendor);
  }

  const products = new Map<string, { _id: Types.ObjectId; name: string; sku: string; price: number; images: string[] }>();
  for (const { vendor, category, sku, ...rest } of seedProducts) {
    const vendorId = vendors.get(vendor)!._id;
    const record = await upsertBy<{ _id: Types.ObjectId; name: string; sku: string; price: number; images: string[] }>(
      Product,
      { vendorId, sku },
      { ...rest, categoryId: categoryIds.get(category)!, images: [seedCatalogImage(sku)] },
    );
    products.set(sku, record);
  }

  const orderIds = new Map<string, Types.ObjectId>();
  for (const seedOrder of seedOrders) {
    const placedAt = new Date(Date.now() - seedOrder.daysAgo * 86_400_000);
    const vendorOrders = seedOrder.shipments.map((shipment) => {
      const items = shipment.items.map(([sku, quantity]) => {
        const product = products.get(sku)!;
        return {
          productId: product._id,
          name: product.name,
          sku: product.sku,
          image: product.images[0],
          unitPrice: product.price,
          quantity,
          lineTotal: lineTotal({ unitPrice: product.price, quantity }),
        };
      });
      const vendor = vendors.get(shipment.vendor)!;
      return {
        vendorId: vendor._id,
        vendorName: vendor.businessName,
        items,
        ...priceVendorLines(items),
        status: shipment.status,
        statusHistory: [
          { status: 'PENDING', actor: 'SYSTEM', at: placedAt },
          ...(shipment.status === 'PENDING'
            ? []
            : [{ status: shipment.status, actor: 'VENDOR', at: placedAt }]),
        ],
      };
    });

    const customer = seedCustomers.find((c) => c.email === seedOrder.customer)!;
    const totals = sumVendorTotals(vendorOrders);
    const customerId = customerIds.get(customer.email)!;
    const order = await upsertBy(
      Order,
      { orderNumber: seedOrder.orderNumber },
      {
        customerId,
        contact: { fullName: customer.name, email: customer.email, phone: customer.phone },
        shippingAddress: { line1: '101 Maple Residency', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001', country: 'India' },
        vendorOrders,
        ...totals,
        paymentStatus: 'PAID',
        createdAt: placedAt,
        updatedAt: placedAt,
      },
      // Keeps the historic dates instead of Mongoose stamping today's date.
      { timestamps: false },
    );
    orderIds.set(seedOrder.orderNumber, order._id);

    await upsertBy(
      Payment,
      { orderId: order._id },
      {
        customerId,
        amount: totals.grandTotal,
        status: 'PAID',
        reference: `SIM-${seedOrder.orderNumber}`,
        processedAt: placedAt,
      },
    );
  }

  for (const seedReview of seedReviews) {
    const product = products.get(seedReview.sku)!;
    const userId = customerIds.get(seedReview.customer)!;
    await upsertBy(
      Review,
      { productId: product._id, userId },
      {
        orderId: orderIds.get(seedReview.order)!,
        rating: seedReview.rating,
        title: seedReview.title,
        comment: seedReview.comment,
      },
    );
    await recalculateProductRating(product._id);
  }

  const [users, vendorCount, categories, productCount, orders, payments, reviews] = await Promise.all([
    User.countDocuments(),
    Vendor.countDocuments(),
    Category.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments(),
    Payment.countDocuments(),
    Review.countDocuments(),
  ]);
  return { users, vendors: vendorCount, categories, products: productCount, orders, payments, reviews };
}
