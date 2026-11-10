import type { FormEvent } from 'react';
import type { Category, PublicVendor } from '../types';
import { Field } from './ui';

const SORT_OPTIONS = [
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Top rated'],
  ['name', 'Name'],
];

interface ProductFiltersProps {
  params: URLSearchParams;
  categories: Category[];
  vendors: PublicVendor[];
  showVendor?: boolean;
  onChange(updates: Record<string, string>): void;
  onClear(): void;
}

/** Every filter is sent to the backend through the URL query string. */
export function ProductFilters({ params, categories, vendors, showVendor = true, onChange, onClear }: ProductFiltersProps) {
  const submitTextFields = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onChange({
      q: String(form.get('q') ?? '').trim(),
      minPrice: String(form.get('minPrice') ?? ''),
      maxPrice: String(form.get('maxPrice') ?? ''),
    });
  };

  return (
    <form className="filters" onSubmit={submitTextFields} aria-label="Product filters">
      <Field label="Search">
        <input name="q" type="search" defaultValue={params.get('q') ?? ''} placeholder="Name, SKU or keyword" />
      </Field>
      <Field label="Category">
        <select value={params.get('category') ?? ''} onChange={(e) => onChange({ category: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category._id} value={category._id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
      {showVendor && (
        <Field label="Vendor">
          <select value={params.get('vendor') ?? ''} onChange={(e) => onChange({ vendor: e.target.value })}>
            <option value="">All vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor._id} value={vendor._id}>
                {vendor.businessName}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="field-pair">
        <Field label="Min price">
          <input name="minPrice" type="number" min="0" defaultValue={params.get('minPrice') ?? ''} />
        </Field>
        <Field label="Max price">
          <input name="maxPrice" type="number" min="0" defaultValue={params.get('maxPrice') ?? ''} />
        </Field>
      </div>
      <Field label="Availability">
        <select value={params.get('inStock') ?? ''} onChange={(e) => onChange({ inStock: e.target.value })}>
          <option value="">Any</option>
          <option value="true">In stock</option>
          <option value="false">Sold out</option>
        </select>
      </Field>
      <Field label="Sort by">
        <select value={params.get('sort') ?? 'newest'} onChange={(e) => onChange({ sort: e.target.value })}>
          {SORT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <div className="filter-actions">
        <button type="submit" className="btn btn-primary">
          Apply
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          Clear
        </button>
      </div>
    </form>
  );
}
