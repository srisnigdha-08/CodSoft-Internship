import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PublicVendor } from '../types';
import { ProductImage } from './ui';

export function VendorCard({ vendor }: { vendor: PublicVendor }) {
  return (
    <Link to={`/vendors/${vendor._id}`} className="vendor-card">
      <ProductImage src={vendor.logo} alt="" className="vendor-logo" />
      <div>
        <h3>{vendor.businessName}</h3>
        <p className="muted small">{vendor.description}</p>
        <p className="muted small vendor-meta">
          <MapPin size={13} aria-hidden="true" /> {vendor.city}
          {vendor.productCount !== undefined && ` · ${vendor.productCount} products`}
        </p>
      </div>
    </Link>
  );
}
