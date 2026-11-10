import { Link } from 'react-router-dom';
import { useAddToCart } from '../hooks/useAddToCart';
import type { Product } from '../types';
import { money } from '../utils/format';
import { ProductImage, Stars } from './ui';

export function ProductCard({ product }: { product: Product }) {
  const { add, busy, canBuy } = useAddToCart();
  const soldOut = product.stock === 0;

  return (
    <article className="product-card">
      <Link to={`/products/${product._id}`} className="product-card-image" tabIndex={-1} aria-hidden="true">
        <ProductImage src={product.images[0]} alt="" />
        {soldOut && <span className="sold-out">Sold out</span>}
      </Link>
      <div className="product-card-body">
        {product.vendor && (
          <Link to={`/vendors/${product.vendor._id}`} className="vendor-link">
            {product.vendor.businessName}
          </Link>
        )}
        <h3>
          <Link to={`/products/${product._id}`}>{product.name}</Link>
        </h3>
        <Stars rating={product.rating} count={product.reviewCount} />
        <div className="product-card-footer">
          <strong className="price">{money(product.price)}</strong>
          {canBuy && (
            <button
              type="button"
              className="btn btn-primary btn-small"
              disabled={soldOut || busy}
              aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
              onClick={() => void add(product._id, product.name)}
            >
              Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} />
      ))}
    </div>
  );
}
