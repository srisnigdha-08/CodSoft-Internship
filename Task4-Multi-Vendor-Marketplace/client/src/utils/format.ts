import type { Role, VendorOrderStatus } from '../types';

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export const money = (amount: number): string => rupees.format(amount);

export const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const homePathFor = (role: Role): string =>
  role === 'ADMIN' ? '/admin' : role === 'VENDOR' ? '/vendor' : '/';

/** For choosing which buttons to show. The server enforces the real rule. */
export const NEXT_FULFILLMENT_STEPS: Record<VendorOrderStatus, VendorOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};
