import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  authenticate,
  currentVendor,
  loadVendor,
  requireRole,
} from '../middleware/auth.js';
import { VENDOR_ORDER_STATUSES } from '../models/constants.js';
import { Order, Product, Vendor } from '../models/index.js';
import type { OrderLean } from '../models/Order.js';
import type { ProductLean } from '../models/Product.js';
import { notFound } from '../utils/AppError.js';
import { roundMoney } from '../utils/money.js';
import {
  addressSchema,
  escapeRegex,
  imageUrlSchema,
  paginated,
  paginationQuery,
  parseId,
  phoneSchema,
} from '../utils/validation.js';
import { withCatalogRefs } from '../services/catalog.service.js';
import { updateFulfillment } from '../services/fulfillment.service.js';
import { toVendorOrderView } from '../services/order.service.js';

const updateProfileSchema = z.object({
  businessName: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  logo: imageUrlSchema.optional(),
  contactEmail: z.email().trim().toLowerCase().optional(),
  phone: phoneSchema.optional(),
  address: addressSchema.optional(),
});

const fulfillmentSchema = z.object({
  status: z.enum(VENDOR_ORDER_STATUSES),
  note: z.string().trim().max(300).optional(),
});

const salesQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

const publicVendorView = (vendor: {
  _id: Types.ObjectId;
  businessName: string;
  description?: string | null;
  logo?: string | null;
  address: { city: string; state: string };
  createdAt?: Date;
}) => ({
  _id: vendor._id,
  businessName: vendor.businessName,
  description: vendor.description,
  logo: vendor.logo,
  city: vendor.address.city,
  state: vendor.address.state,
  createdAt: vendor.createdAt,
});

const sumBy = <T>(rows: T[], pick: (row: T) => number) =>
  roundMoney(rows.reduce((total, row) => total + pick(row), 0));

export const vendorsRouter = Router();

/* Signed-in vendor. These routes come first so "me" never matches "/:id". */
const vendorOnly = [authenticate, requireRole('VENDOR'), loadVendor];

vendorsRouter.get('/me', ...vendorOnly, (req, res) => {
  res.json({ vendor: currentVendor(req) });
});

vendorsRouter.patch('/me', ...vendorOnly, async (req, res) => {
  const vendor = currentVendor(req);
  vendor.set(updateProfileSchema.parse(req.body));
  await vendor.save();
  res.json({ vendor });
});

vendorsRouter.get('/me/dashboard', ...vendorOnly, async (req, res) => {
  const vendorId = currentVendor(req)._id;
  const [totalProducts, activeProducts, lowStockProducts, groups] = await Promise.all([
    Product.countDocuments({ vendorId }),
    Product.countDocuments({ vendorId, isActive: true }),
    Product.countDocuments({ vendorId, isActive: true, stock: { $lte: 5 } }),
    Order.aggregate<{ _id: string; count: number; revenue: number }>([
      { $match: { 'vendorOrders.vendorId': vendorId, paymentStatus: { $in: ['PAID', 'REFUNDED'] } } },
      { $unwind: '$vendorOrders' },
      { $match: { 'vendorOrders.vendorId': vendorId } },
      {
        $group: {
          _id: '$vendorOrders.status',
          count: { $sum: 1 },
          revenue: { $sum: '$vendorOrders.subtotal' },
        },
      },
    ]),
  ]);

  const countOf = (...statuses: string[]) =>
    groups.filter((g) => statuses.includes(g._id)).reduce((sum, g) => sum + g.count, 0);

  res.json({
    totalProducts,
    activeProducts,
    lowStockProducts,
    totalOrders: countOf(...VENDOR_ORDER_STATUSES),
    pendingOrders: countOf('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'),
    completedOrders: countOf('DELIVERED'),
    cancelledOrders: countOf('CANCELLED'),
    revenue: sumBy(groups.filter((g) => g._id !== 'CANCELLED'), (g) => g.revenue),
  });
});

vendorsRouter.get('/me/sales', ...vendorOnly, async (req, res) => {
  const vendorId = currentVendor(req)._id;
  const { days } = salesQuery.parse(req.query);
  const since = new Date(Date.now() - days * 86_400_000);
  const sold = [
    { $match: { 'vendorOrders.vendorId': vendorId, paymentStatus: 'PAID', createdAt: { $gte: since } } },
    { $unwind: '$vendorOrders' },
    { $match: { 'vendorOrders.vendorId': vendorId, 'vendorOrders.status': { $ne: 'CANCELLED' } } },
  ];

  const [daily, topProducts] = await Promise.all([
    Order.aggregate<{ _id: string; revenue: number; orders: number }>([
      ...sold,
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$vendorOrders.subtotal' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate<{ _id: Types.ObjectId; name: string; quantity: number; revenue: number }>([
      ...sold,
      { $unwind: '$vendorOrders.items' },
      {
        $group: {
          _id: '$vendorOrders.items.productId',
          name: { $first: '$vendorOrders.items.name' },
          quantity: { $sum: '$vendorOrders.items.quantity' },
          revenue: { $sum: '$vendorOrders.items.lineTotal' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
  ]);

  res.json({
    days,
    totalRevenue: sumBy(daily, (d) => d.revenue),
    totalOrders: daily.reduce((sum, d) => sum + d.orders, 0),
    daily: daily.map((d) => ({ date: d._id, revenue: roundMoney(d.revenue), orders: d.orders })),
    topProducts: topProducts.map((p) => ({
      productId: p._id,
      name: p.name,
      quantity: p.quantity,
      revenue: roundMoney(p.revenue),
    })),
  });
});

vendorsRouter.get('/me/products', ...vendorOnly, async (req, res) => {
  const vendorId = currentVendor(req)._id;
  const query = paginationQuery
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      q: z.string().trim().max(100).optional(),
    })
    .parse(req.query);
  const filter = {
    vendorId,
    ...(query.q ? { name: new RegExp(escapeRegex(query.q), 'i') } : {}),
  };
  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<ProductLean[]>(),
    Product.countDocuments(filter),
  ]);
  res.json(paginated(await withCatalogRefs(products), total, query.page, query.limit));
});

vendorsRouter.get('/me/products/:productId', ...vendorOnly, async (req, res) => {
  const product = await Product.findOne({
    _id: parseId(req.params.productId, 'product id'),
    vendorId: currentVendor(req)._id,
  }).lean<ProductLean>();
  if (!product) throw notFound('Product');
  const [view] = await withCatalogRefs([product]);
  res.json({ product: view });
});

vendorsRouter.get('/me/orders', ...vendorOnly, async (req, res) => {
  const vendorId = currentVendor(req)._id;
  const query = paginationQuery
    .extend({ status: z.enum(VENDOR_ORDER_STATUSES).optional() })
    .parse(req.query);
  const filter = {
    // Unpaid orders are not actionable and may still be released.
    paymentStatus: { $in: ['PAID', 'REFUNDED'] as ('PAID' | 'REFUNDED')[] },
    vendorOrders: { $elemMatch: { vendorId, ...(query.status ? { status: query.status } : {}) } },
  };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<OrderLean[]>(),
    Order.countDocuments(filter),
  ]);
  res.json(
    paginated(
      orders.map((order) => toVendorOrderView(order, vendorId)),
      total,
      query.page,
      query.limit,
    ),
  );
});

vendorsRouter.get('/me/orders/:orderId', ...vendorOnly, async (req, res) => {
  const vendorId = currentVendor(req)._id;
  const order = await Order.findOne({
    _id: parseId(req.params.orderId, 'order id'),
    'vendorOrders.vendorId': vendorId,
  }).lean<OrderLean>();
  if (!order) throw notFound('Order');
  res.json({ order: toVendorOrderView(order, vendorId) });
});

vendorsRouter.patch('/me/orders/:orderId/status', ...vendorOnly, async (req, res) => {
  const vendorId = currentVendor(req)._id;
  const { status, note } = fulfillmentSchema.parse(req.body);
  const order = await updateFulfillment(
    parseId(req.params.orderId, 'order id'),
    vendorId,
    status,
    note,
  );
  res.json({ order: toVendorOrderView(order, vendorId) });
});

/* Public storefront */
vendorsRouter.get('/', async (req, res) => {
  const { page, limit } = paginationQuery.parse(req.query);
  const filter = { approvalStatus: 'APPROVED' as const };
  const [vendors, total] = await Promise.all([
    Vendor.find(filter).sort({ businessName: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Vendor.countDocuments(filter),
  ]);
  const counts = await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { vendorId: { $in: vendors.map((v) => v._id) }, isActive: true } },
    { $group: { _id: '$vendorId', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((row) => [row._id.toString(), row.count]));
  const items = vendors.map((vendor) => ({
    ...publicVendorView(vendor),
    productCount: countById.get(vendor._id.toString()) ?? 0,
  }));
  res.json(paginated(items, total, page, limit));
});

vendorsRouter.get('/:id', async (req, res) => {
  const vendor = await Vendor.findOne({
    _id: parseId(req.params.id),
    approvalStatus: 'APPROVED',
  }).lean();
  if (!vendor) throw notFound('Vendor');
  res.json({ vendor: publicVendorView(vendor) });
});
