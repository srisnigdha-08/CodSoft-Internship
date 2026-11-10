import { CatalogBrowser } from '../components/CatalogBrowser';
import { PageHeader } from '../components/ui';

export function ProductsPage() {
  return (
    <>
      <PageHeader title="All products" subtitle="Everything currently on sale across the marketplace." />
      <CatalogBrowser />
    </>
  );
}
