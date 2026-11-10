import type { Types } from 'mongoose';
import { Category, Product, Vendor } from '../models/index.js';
import type { ProductLean } from '../models/Product.js';

/**
 * A product is public only when it is active, its vendor is approved and its
 * category is active. Listing, detail pages, vendor stores and checkout all
 * apply this same rule.
 */
export async function publicProductScope() {
  const [vendorIds, categoryIds] = await Promise.all([
    Vendor.distinct('_id', { approvalStatus: 'APPROVED' }),
    Category.distinct('_id', { isActive: true }),
  ]);
  return {
    isActive: true,
    vendorId: { $in: vendorIds as Types.ObjectId[] },
    categoryId: { $in: categoryIds as Types.ObjectId[] },
  };
}

export async function findPublicProduct(productId: Types.ObjectId): Promise<ProductLean | null> {
  const scope = await publicProductScope();
  return Product.findOne({ _id: productId, ...scope }).lean<ProductLean>();
}

/** Replaces vendorId/categoryId references with the minimal display data. */
export async function withCatalogRefs(products: ProductLean[]) {
  const [vendors, categories] = await Promise.all([
    Vendor.find({ _id: { $in: products.map((p) => p.vendorId) } })
      .select('businessName logo approvalStatus')
      .lean(),
    Category.find({ _id: { $in: products.map((p) => p.categoryId) } })
      .select('name isActive')
      .lean(),
  ]);
  const vendorById = new Map(vendors.map((v) => [v._id.toString(), v]));
  const categoryById = new Map(categories.map((c) => [c._id.toString(), c]));

  return products.map((product) => {
    const vendor = vendorById.get(product.vendorId.toString());
    const category = categoryById.get(product.categoryId.toString());
    return {
      ...product,
      vendor: vendor && {
        _id: vendor._id,
        businessName: vendor.businessName,
        logo: vendor.logo,
        approvalStatus: vendor.approvalStatus,
      },
      category: category && { _id: category._id, name: category.name },
    };
  });
}
