import { useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { catalogService } from '../services';
import { EmptyState, ResourceView } from './Feedback';
import { ProductFilters } from './ProductFilters';
import { ProductGrid } from './ProductCard';
import { Pagination } from './ui';

/** Backend-driven listing shared by the marketplace page and vendor stores. */
export function CatalogBrowser({ vendorId }: { vendorId?: string }) {
  const [params, setParams] = useSearchParams();
  const queryKey = params.toString();

  const products = useResource(`${vendorId ?? 'all'}?${queryKey}`, () =>
    catalogService.products({
      ...Object.fromEntries(params),
      ...(vendorId ? { vendor: vendorId } : {}),
      limit: 12,
    }),
  );
  const categories = useResource('categories', catalogService.categories);
  const vendors = useResource('vendors', catalogService.vendors);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    setParams(next);
  };

  const goToPage = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="catalog-layout">
      <aside>
        <ProductFilters
          key={queryKey}
          params={params}
          categories={categories.data ?? []}
          vendors={vendors.data?.items ?? []}
          showVendor={!vendorId}
          onChange={updateParams}
          onClear={() => setParams(new URLSearchParams())}
        />
      </aside>
      <section aria-label="Products">
        <ResourceView resource={products}>
          {(result) =>
            result.items.length === 0 ? (
              <EmptyState title="No products match these filters">Try removing a filter or searching for something else.</EmptyState>
            ) : (
              <>
                <p className="muted result-count">
                  {result.total} {result.total === 1 ? 'product' : 'products'}
                </p>
                <ProductGrid products={result.items} />
                <Pagination page={result.page} totalPages={result.totalPages} onChange={goToPage} />
              </>
            )
          }
        </ResourceView>
      </section>
    </div>
  );
}
