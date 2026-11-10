import { Link, useNavigate } from 'react-router-dom';
import { ResourceView } from '../components/Feedback';
import { ProductGrid } from '../components/ProductCard';
import { ProductImage } from '../components/ui';
import { VendorCard } from '../components/VendorCard';
import { useResource } from '../hooks/useResource';
import { catalogService } from '../services';

export function HomePage() {
  const navigate = useNavigate();
  const categories = useResource('home-categories', catalogService.categories);
  const featured = useResource('home-featured', () => catalogService.products({ sort: 'rating', limit: 8, inStock: 'true' }));
  const vendors = useResource('home-vendors', catalogService.vendors);

  return (
    <div className="stack-lg">
      <section className="hero">
        <div>
          <span className="eyebrow">Many independent stores, one cart</span>
          <h1>A market full of small shops, delivered together.</h1>
          <p>Browse every store at once, fill one cart and check out once. Each shop ships and tracks its part of your order.</p>
          <form
            className="hero-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const q = String(new FormData(event.currentTarget).get('q') ?? '').trim();
              navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
            }}
          >
            <input name="q" type="search" placeholder="Try headphones, tea or backpack" aria-label="Search the marketplace" />
            <button type="submit" className="btn btn-accent">
              Search
            </button>
          </form>
        </div>
      </section>

      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="section-title">
          Shop by category
        </h2>
        <ResourceView resource={categories}>
          {(items) => (
            <div className="category-row">
              {items.map((category) => (
                <Link key={category._id} to={`/products?category=${category._id}`} className="category-tile">
                  <ProductImage src={category.image} alt="" />
                  <span>{category.name}</span>
                </Link>
              ))}
            </div>
          )}
        </ResourceView>
      </section>

      <section aria-labelledby="featured-heading">
        <div className="section-head">
          <h2 id="featured-heading" className="section-title">
            Featured products
          </h2>
          <Link to="/products">See all</Link>
        </div>
        <ResourceView resource={featured}>{(result) => <ProductGrid products={result.items} />}</ResourceView>
      </section>

      <section aria-labelledby="vendors-heading">
        <div className="section-head">
          <h2 id="vendors-heading" className="section-title">
            Meet the stores
          </h2>
          <Link to="/vendors">All stores</Link>
        </div>
        <ResourceView resource={vendors}>
          {(result) => (
            <div className="vendor-grid">
              {result.items.map((vendor) => (
                <VendorCard key={vendor._id} vendor={vendor} />
              ))}
            </div>
          )}
        </ResourceView>
      </section>
    </div>
  );
}
