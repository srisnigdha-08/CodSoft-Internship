export const ROLES = ['CUSTOMER', 'VENDOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'DEACTIVATED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VENDOR_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type VendorApprovalStatus = (typeof VENDOR_APPROVAL_STATUSES)[number];

export const VENDOR_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type VendorOrderStatus = (typeof VENDOR_ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STATUS_ACTORS = ['SYSTEM', 'CUSTOMER', 'VENDOR', 'ADMIN'] as const;
export type StatusActor = (typeof STATUS_ACTORS)[number];

export const SIMULATED_PAYMENT_METHOD = 'SIMULATED';
