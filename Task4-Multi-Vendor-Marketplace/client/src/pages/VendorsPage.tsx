import { ResourceView } from '../components/Feedback';
import { PageHeader } from '../components/ui';
import { VendorCard } from '../components/VendorCard';
import { useResource } from '../hooks/useResource';
import { catalogService } from '../services';

export function VendorsPage() {
  const vendors = useResource('vendors', catalogService.vendors);
  return (
    <>
      <PageHeader title="Stores" subtitle="Independent sellers approved to trade on Mela." />
      <ResourceView resource={vendors}>
        {(result) => (
          <div className="vendor-grid">
            {result.items.map((vendor) => (
              <VendorCard key={vendor._id} vendor={vendor} />
            ))}
          </div>
        )}
      </ResourceView>
    </>
  );
}
