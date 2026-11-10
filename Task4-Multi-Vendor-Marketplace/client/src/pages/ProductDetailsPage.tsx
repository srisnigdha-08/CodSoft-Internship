import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorText } from '../api/client';
import { EmptyState, ErrorBanner, ResourceView } from '../components/Feedback';
import { Field, ProductImage, QuantityStepper, Stars } from '../components/ui';
import { useAddToCart } from '../hooks/useAddToCart';
import { useAuth } from '../hooks/useAuth';
import { useResource } from '../hooks/useResource';
import { useToast } from '../hooks/useToast';
import { catalogService } from '../services';
import type { Product } from '../types';
import { money, shortDate } from '../utils/format';

function PurchasePanel({ product }: { product: Product }) {
  const { add, busy, canBuy } = useAddToCart();
  const [quantity, setQuantity] = useState(1);
  const max = Math.min(product.stock, 99);

  return (
    <div className="purchase-panel">
      <strong className="price price-large">{money(product.price)}</strong>
      <p className={product.stock > 0 ? 'stock-in' : 'stock-out'}>
        {product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}
      </p>
      {canBuy && product.stock > 0 && (
        <div className="purchase-actions">
          <QuantityStepper value={quantity} max={max} onChange={setQuantity} label="Quantity" />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void add(product._id, product.name, quantity)}>
            Add to cart
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewForm({ productId, onSubmitted }: { productId: string; onSubmitted(): void }) {
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await catalogService.createReview({ productId, rating, comment, ...(title ? { title } : {}) });
      toast('Thanks for your review');
      onSubmitted();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <form className="card stack" onSubmit={(e) => void submit(e)}>
      <h3>Review this product</h3>
      <ErrorBanner message={error} />
      <Field label="Rating">
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} out of 5
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title (optional)">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </Field>
      <Field label="Your review">
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} required minLength={3} maxLength={2000} />
      </Field>
      <button type="submit" className="btn btn-primary">
        Submit review
      </button>
    </form>
  );
}

function ReviewsSection({ productId, onChanged }: { productId: string; onChanged(): void }) {
  const { session } = useAuth();
  const isCustomer = session?.user.role === 'CUSTOMER';
  const reviews = useResource(`reviews-${productId}`, () => catalogService.reviews(productId));
  const eligibility = useResource(`eligibility-${productId}-${session?.user._id ?? 'anon'}`, () =>
    isCustomer ? catalogService.reviewEligibility(productId) : Promise.resolve({ canReview: false, hasReviewed: false }),
  );

  return (
    <section id="reviews" className="stack" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="section-title">
        Customer reviews
      </h2>
      {eligibility.data?.canReview && (
        <ReviewForm
          productId={productId}
          onSubmitted={() => {
            reviews.reload();
            eligibility.reload();
            onChanged();
          }}
        />
      )}
      <ResourceView resource={reviews}>
        {(result) =>
          result.items.length === 0 ? (
            <EmptyState title="No reviews yet">Customers can review this product after it is delivered.</EmptyState>
          ) : (
            <ul className="review-list">
              {result.items.map((review) => (
                <li key={review._id} className="card">
                  <div className="card-title-row">
                    <strong>{review.title || 'Review'}</strong>
                    <Stars rating={review.rating} />
                  </div>
                  <p>{review.comment}</p>
                  <p className="muted small">
                    {review.authorName} · {shortDate(review.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )
        }
      </ResourceView>
    </section>
  );
}

function Gallery({ product }: { product: Product }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="gallery">
      <ProductImage src={product.images[selected]} alt={product.name} className="gallery-main" />
      {product.images.length > 1 && (
        <div className="gallery-thumbs">
          {product.images.map((image, index) => (
            <button key={image} type="button" aria-label={`Show image ${index + 1}`} onClick={() => setSelected(index)}>
              <ProductImage src={image} alt="" className="thumb" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductDetailsPage() {
  const { id = '' } = useParams();
  const product = useResource(`product-${id}`, () => catalogService.product(id));

  return (
    <ResourceView resource={product}>
      {(item) => (
        <div className="stack-lg">
          <div className="product-detail">
            <Gallery product={item} />
            <div className="stack">
              {item.category && (
                <Link to={`/products?category=${item.category._id}`} className="eyebrow">
                  {item.category.name}
                </Link>
              )}
              <h1>{item.name}</h1>
              <Stars rating={item.rating} count={item.reviewCount} />
              {item.vendor && (
                <p>
                  Sold by <Link to={`/vendors/${item.vendor._id}`}>{item.vendor.businessName}</Link>
                </p>
              )}
              <PurchasePanel product={item} />
              <p>{item.description}</p>
              <p className="muted small">SKU {item.sku}</p>
            </div>
          </div>
          <ReviewsSection productId={item._id} onChanged={product.reload} />
        </div>
      )}
    </ResourceView>
  );
}
