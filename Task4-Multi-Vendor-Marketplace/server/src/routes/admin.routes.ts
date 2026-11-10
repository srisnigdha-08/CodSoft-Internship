import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentUser, requireRole } from '../middleware/auth.js';
import {
  PAYMENT_STATUSES,
  USER_STATUSES,
  VENDOR_APPROVAL_STATUSES,
  type VendorApprovalStatus,
} from '../models/constants.js';
import { Category, Order, Payment, Product, User, Vendor } from '../models/index.js';
import type { OrderLean } from '../models/Order.js';
import type { ProductLean } from '../models/Product.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';
import { roundMoney } from '../utils/money.js';
import { escapeRegex, paginated, paginationQuery, parseId } from '../utils/validation.js';
import { withCatalogRefs } from '../services/catalog.service.js';
import { toOrderView } from '../services/order.service.js';

const VENDOR_TRANSITIONS: Record<VendorApprovalStatus, VendorApprovalStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['SUSPENDED'],
  SUSPENDED: ['APPROVED', 'REJECTED'],
  REJECTED: ['APPROVED'],
};

const vendorStatusSchema = z.object({
  status: z.enum(VENDOR_APPROVAL_STATUSES),
  note: z.string().trim().max(500).optional(),
});

const userUpdateSchema = z
  .object({
    role: z.enum(['CUSTOMER', 'ADMIN']).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((body) => body.role !== undefined || body.status !== undefined, {
    message: 'Provide a role or status',
  });

const pageWithSearch = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('ADMIN'));

adminRouter.get('/dashboard', async (_req, res) => {
  const [users, vendors, pendingVendors, products, activeProducts, orders, revenue] = await Promise.all([
    User.countDocuments(),
    Vendor.countDocuments(),
    Vendor.countDocuments({ approvalStatus: 'PENDING' }),
    Product.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Payment.aggregate<{ net: number }>([
      { $match: { status: 'PAID' } },
      { $group: { _id: null, net: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } },
    ]),
  ]);
  res.json({
    users,
    vendors,
    pendingVendors,
    products,
    activeProducts,
    orders,
    revenue: roundMoney(revenue[0]?.net ?? 0),
  });
});

adminRouter.get('/vendors', async (req, res) => {
  const query = pageWithSearch
    .extend({ status: z.enum(VENDOR_APPROVAL_STATUSES).optional() })
    .parse(req.query);
  const filter = {
    ...(query.status ? { approvalStatus: query.status } : {}),
    ...(query.q ? { businessName: new RegExp(escapeRegex(query.q), 'i') } : {}),
  };
  const [vendors, total] = await Promise.all([
    Vendor.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Vendor.countDocuments(filter),
  ]);
  const owners = await User.find({ _id: { $in: vendors.map((v) => v.userId) } })
    .select('name email status')
    .lean();
  const ownerById = new Map(owners.map((owner) => [owner._id.toString(), owner]));
  const items = vendors.map((vendor) => ({
    ...vendor,
    owner: ownerById.get(vendor.userId.toString()),
  }));
  res.json(paginated(items, total, query.page, query.limit));
});

adminRouter.patch('/vendors/:id/status', async (req, res) => {
  const { status, note } = vendorStatusSchema.parse(req.body);
  const vendorId = parseId(req.params.id);
  const current = await Vendor.findById(vendorId).select('approvalStatus').lean();
  if (!current) throw notFound('Vendor');
  if (!VENDOR_TRANSITIONS[current.approvalStatus].includes(status)) {
    throw conflict(`Cannot change a vendor from ${current.approvalStatus} to ${status}`);
  }
  const vendor = await Vendor.findOneAndUpdate(
    { _id: vendorId, approvalStatus: current.approvalStatus },
    { $set: { approvalStatus: status, ...(note ? { approvalNote: note } : {}) } },
    { returnDocument: 'after' },
  );
  if (!vendor) throw conflict('This vendor was just updated. Refresh and try again.');
  res.json({ vendor });
});

adminRouter.get('/users', async (req, res) => {
  const query = pageWithSearch.parse(req.query);
  const pattern = query.q ? new RegExp(escapeRegex(query.q), 'i') : null;
  const filter = pattern ? { $or: [{ name: pattern }, { email: pattern }] } : {};
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    User.countDocuments(filter),
  ]);
  res.json(paginated(users.map((u) => u.toJSON()), total, query.page, query.limit));
});

adminRouter.patch('/users/:id', async (req, res) => {
  const actor = currentUser(req);
  const targetId = parseId(req.params.id);
  const input = userUpdateSchema.parse(req.body);

  // Also guarantees at least one active admin always remains.
  if (actor._id.equals(targetId)) {
    throw forbidden('You cannot change your own role or status');
  }
  const target = await User.findById(targetId);
  if (!target) throw notFound('User');
  if (input.role && target.role === 'VENDOR') {
    throw badRequest('Vendor accounts keep their role; manage the store from vendor management');
  }

  target.set(input);
  await target.save();

  // A store cannot keep selling once its owner's account is deactivated.
  if (input.status === 'DEACTIVATED' && target.role === 'VENDOR') {
    await Vendor.updateOne(
      { userId: target._id, approvalStatus: 'APPROVED' },
      { $set: { approvalStatus: 'SUSPENDED', approvalNote: 'Owner account deactivated' } },
    );
  }
  res.json({ user: target.toJSON() });
});

adminRouter.get('/categories', async (_req, res) => {
  res.json({ items: await Category.find().sort({ name: 1 }).lean() });
});

adminRouter.get('/products', async (req, res) => {
  const query = pageWithSearch.parse(req.query);
  const pattern = query.q ? new RegExp(escapeRegex(query.q), 'i') : null;
  const filter = pattern ? { $or: [{ name: pattern }, { sku: pattern }] } : {};
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

adminRouter.get('/orders', async (req, res) => {
  const query = pageWithSearch
    .extend({ paymentStatus: z.enum(PAYMENT_STATUSES).optional() })
    .parse(req.query);
  const filter = {
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.q ? { orderNumber: new RegExp(escapeRegex(query.q), 'i') } : {}),
  };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<OrderLean[]>(),
    Order.countDocuments(filter),
  ]);
  res.json(paginated(orders.map(toOrderView), total, query.page, query.limit));
});
