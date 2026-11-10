import type { Types } from 'mongoose';
import { Cart, Order, Payment, Product } from '../models/index.js';
import type { UserDoc } from '../middleware/auth.js';
import type { OrderLean, VendorOrderLean } from '../models/Order.js';
import { nextSequence } from '../models/Counter.js';
import { badRequest, conflict } from '../utils/AppError.js';
import { lineTotal, priceVendorLines, sumVendorTotals } from '../utils/money.js';
import { runUnitOfWork, type UnitOfWork } from '../utils/unitOfWork.js';
import { groupLinesByVendor, loadCartLines, type CartLine } from './cart.service.js';

export interface ShippingInput {
  fullName: string;
  phone: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export type OverallOrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_FAILED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/** The overall status is always derived, so it cannot disagree with vendor fulfillment. */
export function deriveOrderStatus(order: Pick<OrderLean, 'paymentStatus' | 'vendorOrders'>): OverallOrderStatus {
  if (order.paymentStatus === 'PENDING') return 'AWAITING_PAYMENT';
  if (order.paymentStatus === 'FAILED') return 'PAYMENT_FAILED';
  const statuses = order.vendorOrders.map((vendorOrder) => vendorOrder.status);
  if (statuses.every((status) => status === 'CANCELLED')) return 'CANCELLED';
  if (statuses.every((status) => status === 'DELIVERED' || status === 'CANCELLED')) return 'COMPLETED';
  return 'IN_PROGRESS';
}

export const toOrderView = (order: OrderLean) => ({ ...order, status: deriveOrderStatus(order) });

/** A vendor sees its own shipment only: no other vendor's items, totals or status. */
export function toVendorOrderView(order: OrderLean, vendorId: Types.ObjectId) {
  const vendorOrder = order.vendorOrders.find((vo) => vo.vendorId.equals(vendorId));
  if (!vendorOrder) throw new Error('Vendor order missing from a vendor-scoped query');
  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    paymentStatus: order.paymentStatus,
    contact: order.contact,
    shippingAddress: order.shippingAddress,
    fulfillment: vendorOrder,
  };
}

function assertCartPurchasable(lines: CartLine[]): void {
  if (lines.length === 0) throw badRequest('Your cart is empty');
  const problems = lines
    .filter((line) => line.issue !== null)
    .map((line) => ({
      productId: line.productId,
      name: line.product?.name ?? 'Removed product',
      issue: line.issue,
      available: line.product?.stock ?? 0,
    }));
  if (problems.length > 0) throw conflict('Some items in your cart cannot be purchased', problems);
}

function buildVendorOrders(lines: CartLine[], now: Date) {
  return groupLinesByVendor(lines).map((group) => {
    const items = group.map((line) => {
      const product = line.product!;
      return {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        image: product.images[0],
        unitPrice: product.price,
        quantity: line.quantity,
        lineTotal: lineTotal({ unitPrice: product.price, quantity: line.quantity }),
      };
    });
    return {
      vendorId: group[0].vendorId,
      vendorName: group[0].vendorName,
      items,
      ...priceVendorLines(items),
      status: 'PENDING' as const,
      statusHistory: [{ status: 'PENDING' as const, actor: 'SYSTEM' as const, at: now }],
    };
  });
}

/** Atomically takes stock for one line; the filter is what prevents overselling. */
async function reserveStock(line: CartLine, uow: UnitOfWork): Promise<void> {
  const reserved = await Product.updateOne(
    { _id: line.productId, isActive: true, stock: { $gte: line.quantity } },
    { $inc: { stock: -line.quantity } },
    { session: uow.session },
  );
  if (reserved.modifiedCount === 0) {
    throw conflict(`${line.product?.name ?? 'A product'} no longer has enough stock`, [
      { productId: line.productId, issue: 'INSUFFICIENT_STOCK' },
    ]);
  }
  uow.onRollback(() =>
    Product.updateOne({ _id: line.productId }, { $inc: { stock: line.quantity } }),
  );
}

/**
 * Reserves stock and creates the order, its payment record and the emptied cart
 * as one unit. Every amount is computed here from current catalog prices.
 */
export async function placeOrder(customer: UserDoc, input: ShippingInput): Promise<OrderLean> {
  const lines = await loadCartLines(customer._id);
  assertCartPurchasable(lines);

  const now = new Date();
  const vendorOrders = buildVendorOrders(lines, now);
  const totals = sumVendorTotals(vendorOrders);
  const orderNumber = `MKT-${1000 + (await nextSequence('order'))}`;

  const orderId = await runUnitOfWork(async (uow) => {
    for (const line of lines) await reserveStock(line, uow);

    const [order] = await Order.create(
      [
        {
          orderNumber,
          customerId: customer._id,
          contact: { fullName: input.fullName, email: customer.email, phone: input.phone },
          shippingAddress: input.address,
          vendorOrders,
          ...totals,
          paymentStatus: 'PENDING',
        },
      ],
      { session: uow.session },
    );
    uow.onRollback(() => Order.deleteOne({ _id: order._id }));

    const [payment] = await Payment.create(
      [{ orderId: order._id, customerId: customer._id, amount: totals.grandTotal }],
      { session: uow.session },
    );
    uow.onRollback(() => Payment.deleteOne({ _id: payment._id }));

    const previousItems = lines.map(({ productId, vendorId, quantity }) => ({
      productId,
      vendorId,
      quantity,
    }));
    await Cart.updateOne(
      { customerId: customer._id },
      { $set: { items: [] } },
      { session: uow.session },
    );
    uow.onRollback(() =>
      Cart.updateOne({ customerId: customer._id }, { $set: { items: previousItems } }),
    );

    return order._id;
  });

  return Order.findById(orderId).orFail().lean<OrderLean>();
}

/** Returns one vendor shipment's items to stock (payment failure or cancellation). */
export async function restockVendorOrder(
  vendorOrder: Pick<VendorOrderLean, 'items'>,
  uow: UnitOfWork,
): Promise<void> {
  for (const item of vendorOrder.items) {
    await Product.updateOne(
      { _id: item.productId },
      { $inc: { stock: item.quantity } },
      { session: uow.session },
    );
    uow.onRollback(() =>
      Product.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } }),
    );
  }
}
