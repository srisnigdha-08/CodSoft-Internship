import type { ClientSession, Types } from 'mongoose';
import { Cart, Category, Product, Vendor } from '../models/index.js';
import { MAX_LINE_QUANTITY } from '../models/Cart.js';
import type { ProductLean } from '../models/Product.js';
import { conflict, notFound } from '../utils/AppError.js';
import { lineTotal, priceVendorLines, sumVendorTotals } from '../utils/money.js';
import { findPublicProduct } from './catalog.service.js';

export type CartIssue = 'UNAVAILABLE' | 'INSUFFICIENT_STOCK';

export interface CartLine {
  productId: Types.ObjectId;
  vendorId: Types.ObjectId;
  vendorName: string;
  quantity: number;
  /** Null only when the product no longer exists. */
  product: ProductLean | null;
  issue: CartIssue | null;
}

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/** Reads the cart joined with live catalog data. Prices always come from Product. */
export async function loadCartLines(customerId: Types.ObjectId): Promise<CartLine[]> {
  const cart = await Cart.findOne({ customerId }).lean();
  if (!cart || cart.items.length === 0) return [];

  const products = await Product.find({
    _id: { $in: cart.items.map((item) => item.productId) },
  }).lean<ProductLean[]>();
  const [vendors, activeCategories] = await Promise.all([
    Vendor.find({ _id: { $in: cart.items.map((item) => item.vendorId) } })
      .select('businessName approvalStatus')
      .lean(),
    Category.distinct('_id', { isActive: true }),
  ]);

  const productById = new Map(products.map((p) => [p._id.toString(), p]));
  const vendorById = new Map(vendors.map((v) => [v._id.toString(), v]));
  const activeCategoryIds = new Set(activeCategories.map((id) => String(id)));

  return cart.items.map((item) => {
    const product = productById.get(item.productId.toString()) ?? null;
    const vendor = vendorById.get(item.vendorId.toString());
    const sellable =
      product?.isActive === true &&
      vendor?.approvalStatus === 'APPROVED' &&
      activeCategoryIds.has(product.categoryId.toString());

    let issue: CartIssue | null = null;
    if (!sellable) issue = 'UNAVAILABLE';
    else if (product.stock < item.quantity) issue = 'INSUFFICIENT_STOCK';

    return {
      productId: item.productId,
      vendorId: item.vendorId,
      vendorName: vendor?.businessName ?? 'Unknown vendor',
      quantity: item.quantity,
      product,
      issue,
    };
  });
}

export function groupLinesByVendor(lines: CartLine[]): CartLine[][] {
  const groups = new Map<string, CartLine[]>();
  for (const line of lines) {
    const key = line.vendorId.toString();
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return [...groups.values()];
}

export async function getCartView(customerId: Types.ObjectId) {
  const lines = await loadCartLines(customerId);

  const vendors = groupLinesByVendor(lines).map((group) => {
    const purchasable = group
      .filter((line) => line.issue === null)
      .map((line) => ({ unitPrice: line.product!.price, quantity: line.quantity }));
    return {
      vendor: { _id: group[0].vendorId, businessName: group[0].vendorName },
      items: group.map((line) => ({
        productId: line.productId,
        name: line.product?.name ?? 'Removed product',
        image: line.product?.images[0],
        unitPrice: line.product?.price ?? 0,
        quantity: line.quantity,
        lineTotal: line.product
          ? lineTotal({ unitPrice: line.product.price, quantity: line.quantity })
          : 0,
        stock: line.product?.stock ?? 0,
        issue: line.issue,
      })),
      totals: priceVendorLines(purchasable),
    };
  });

  return {
    vendors,
    totals: sumVendorTotals(vendors.map((group) => group.totals)),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    canCheckout: lines.length > 0 && lines.every((line) => line.issue === null),
  };
}

function assertWithinLimits(requested: number, stock: number): void {
  if (requested > MAX_LINE_QUANTITY) {
    throw conflict(`You can buy at most ${MAX_LINE_QUANTITY} of one product per order`);
  }
  if (requested > stock) {
    throw conflict(`Only ${stock} left in stock`, { available: stock });
  }
}

export async function addCartItem(
  customerId: Types.ObjectId,
  productId: Types.ObjectId,
  quantity: number,
): Promise<void> {
  const product = await findPublicProduct(productId);
  if (!product) throw notFound('Product');

  const existing = await Cart.findOne(
    { customerId, 'items.productId': productId },
    { 'items.$': 1 },
  ).lean();
  assertWithinLimits((existing?.items[0]?.quantity ?? 0) + quantity, product.stock);

  const increment = () =>
    Cart.updateOne(
      { customerId, 'items.productId': productId },
      { $inc: { 'items.$.quantity': quantity } },
    );

  if ((await increment()).modifiedCount > 0) return;
  try {
    // vendorId is taken from the product record, never from the client.
    await Cart.updateOne(
      { customerId, 'items.productId': { $ne: productId } },
      { $push: { items: { productId, vendorId: product.vendorId, quantity } } },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    await increment(); // A concurrent request added the same line first.
  }
}

export async function setCartItemQuantity(
  customerId: Types.ObjectId,
  productId: Types.ObjectId,
  quantity: number,
): Promise<void> {
  const product = await Product.findById(productId).select('stock').lean();
  if (!product) throw notFound('Product');
  assertWithinLimits(quantity, product.stock);

  const result = await Cart.updateOne(
    { customerId, 'items.productId': productId },
    { $set: { 'items.$.quantity': quantity } },
  );
  if (result.matchedCount === 0) throw notFound('Cart item');
}

export async function removeCartItem(
  customerId: Types.ObjectId,
  productId: Types.ObjectId,
): Promise<void> {
  const result = await Cart.updateOne(
    { customerId, 'items.productId': productId },
    { $pull: { items: { productId } } },
  );
  if (result.matchedCount === 0) throw notFound('Cart item');
}

interface ReturnedItem {
  productId: Types.ObjectId;
  vendorId: Types.ObjectId;
  quantity: number;
}

/** Puts released order items back in the cart so the customer can retry. */
export async function returnItemsToCart(
  customerId: Types.ObjectId,
  returned: ReturnedItem[],
  session: ClientSession | undefined,
): Promise<void> {
  const cart = await Cart.findOne({ customerId }).session(session ?? null).lean();
  const merged = new Map(
    (cart?.items ?? []).map((item) => [
      item.productId.toString(),
      { productId: item.productId, vendorId: item.vendorId, quantity: item.quantity },
    ]),
  );
  for (const item of returned) {
    const key = item.productId.toString();
    const current = merged.get(key)?.quantity ?? 0;
    merged.set(key, { ...item, quantity: Math.min(current + item.quantity, MAX_LINE_QUANTITY) });
  }
  await Cart.updateOne(
    { customerId },
    { $set: { items: [...merged.values()] } },
    { upsert: true, session },
  );
}
