import { MapPin } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { CatalogBrowser } from '../components/CatalogBrowser';
import { ResourceView } from '../components/Feedback';
import { ProductImage } from '../components/ui';
import { useResource } from '../hooks/useResource';
import { catalogService } from '../services';

export function VendorStorePage() {
  const { id = '' } = useParams();
  const vendor = useResource(`vendor-${id}`, () => catalogService.vendor(id));

  return (
    <ResourceView resource={vendor}>
      {(store) => (
        <div className="stack-lg">
          <header className="store-banner">
            <ProductImage src={store.logo} alt="" className="store-logo" />
            <div>
              <h1>{store.businessName}</h1>
              <p>{store.description}</p>
              <p className="muted small vendor-meta">
                <MapPin size={13} aria-hidden="true" /> {store.city}, {store.state}
              </p>
            </div>
          </header>
          <CatalogBrowser vendorId={store._id} />
        </div>
      )}
    </ResourceView>
  );
}
