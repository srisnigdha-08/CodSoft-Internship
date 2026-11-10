import { Minus, Plus, Star } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { titleCase } from '../utils/format';

const STATUS_TONES: Record<string, string> = {
  APPROVED: 'good', PAID: 'good', DELIVERED: 'good', COMPLETED: 'good', ACTIVE: 'good',
  PENDING: 'warn', AWAITING_PAYMENT: 'warn', CONFIRMED: 'info', PROCESSING: 'info', IN_PROGRESS: 'info',
  SHIPPED: 'info', REFUNDED: 'neutral', INACTIVE: 'neutral',
  FAILED: 'bad', PAYMENT_FAILED: 'bad', CANCELLED: 'bad', REJECTED: 'bad', SUSPENDED: 'bad', DEACTIVATED: 'bad',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${STATUS_TONES[status] ?? 'neutral'}`}>{titleCase(status)}</span>;
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="stars" aria-label={`Rated ${rating} out of 5`}>
      <Star size={15} aria-hidden="true" className={rating > 0 ? 'star-on' : 'star-off'} />
      <span>{rating > 0 ? rating.toFixed(1) : 'New'}</span>
      {count !== undefined && count > 0 && <span className="muted">({count})</span>}
    </span>
  );
}

export function ProductImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={`image-fallback ${className ?? ''}`} role="img" aria-label={alt}>
        No image
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setBroken(true)} />;
}

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange(value: number): void;
  label: string;
  disabled?: boolean;
}

export function QuantityStepper({ value, max, onChange, label, disabled }: QuantityStepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Decrease quantity" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
        <Minus size={15} aria-hidden="true" />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Increase quantity" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange(page: number): void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button type="button" className="btn btn-ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="muted small">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
