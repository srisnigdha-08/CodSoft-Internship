import {
  DELIVERY_FEE_PER_VENDOR_MINOR,
  FREE_DELIVERY_THRESHOLD_MINOR,
  TAX_RATE_BASIS_POINTS,
} from '../config/pricing.js';

export const toMinor = (amount: number): number => Math.round(amount * 100);
export const fromMinor = (minor: number): number => minor / 100;
export const roundMoney = (amount: number): number => fromMinor(toMinor(amount));

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export interface VendorTotals {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

export interface OrderTotals {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  grandTotal: number;
}

export const lineTotal = (line: PricedLine): number =>
  fromMinor(toMinor(line.unitPrice) * line.quantity);

/** Prices a single vendor's shipment: tax and delivery are charged per vendor. */
export function priceVendorLines(lines: PricedLine[]): VendorTotals {
  const subtotal = lines.reduce((sum, line) => sum + toMinor(line.unitPrice) * line.quantity, 0);
  const tax = Math.round((subtotal * TAX_RATE_BASIS_POINTS) / 10_000);
  const deliveryFee =
    subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD_MINOR ? 0 : DELIVERY_FEE_PER_VENDOR_MINOR;
  return {
    subtotal: fromMinor(subtotal),
    tax: fromMinor(tax),
    deliveryFee: fromMinor(deliveryFee),
    total: fromMinor(subtotal + tax + deliveryFee),
  };
}

export function sumVendorTotals(groups: VendorTotals[]): OrderTotals {
  const sum = (pick: (group: VendorTotals) => number) =>
    fromMinor(groups.reduce((acc, group) => acc + toMinor(pick(group)), 0));
  return {
    subtotal: sum((g) => g.subtotal),
    tax: sum((g) => g.tax),
    deliveryFee: sum((g) => g.deliveryFee),
    grandTotal: sum((g) => g.total),
  };
}
