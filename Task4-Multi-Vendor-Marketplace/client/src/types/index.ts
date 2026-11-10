export type Role = 'CUSTOMER' | 'VENDOR' | 'ADMIN';
export type VendorApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type VendorOrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type OverallOrderStatus = 'AWAITING_PAYMENT' | 'PAYMENT_FAILED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  createdAt: string;
}

export interface VendorSummary {
  _id: string;
  businessName: string;
  approvalStatus: VendorApprovalStatus;
}

export interface Session {
  user: User;
  vendor: VendorSummary | null;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  isActive: boolean;
}

export interface PublicVendor {
  _id: string;
  businessName: string;
  description?: string;
  logo?: string;
  city: string;
  state: string;
  createdAt: string;
  productCount?: number;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  stock: number;
  sku: string;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  vendorId: string;
  categoryId: string;
  vendor?: { _id: string; businessName: string; logo?: string; approvalStatus: VendorApprovalStatus };
  category?: { _id: string; name: string };
}

export interface Review {
  _id: string;
  productId: string;
  rating: number;
  title?: string;
  comment: string;
  authorName: string;
  createdAt: string;
}

export type CartIssue = 'UNAVAILABLE' | 'INSUFFICIENT_STOCK';

export interface CartItem {
  productId: string;
  name: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  issue: CartIssue | null;
}

export interface VendorTotals {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
}

export interface CartVendorGroup {
  vendor: { _id: string; businessName: string };
  items: CartItem[];
  totals: VendorTotals;
}

export interface Cart {
  vendors: CartVendorGroup[];
  totals: { subtotal: number; tax: number; deliveryFee: number; grandTotal: number };
  itemCount: number;
  canCheckout: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface VendorOrder extends VendorTotals {
  _id: string;
  vendorId: string;
  vendorName: string;
  items: OrderItem[];
  status: VendorOrderStatus;
  statusHistory: { status: VendorOrderStatus; actor: string; at: string; note?: string }[];
}

export interface OrderContact {
  fullName: string;
  email: string;
  phone: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customerId: string;
  contact: OrderContact;
  shippingAddress: Address;
  vendorOrders: VendorOrder[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  grandTotal: number;
  paymentStatus: PaymentStatus;
  status: OverallOrderStatus;
  createdAt: string;
}

export interface Payment {
  _id: string;
  orderId: string;
  amount: number;
  refundedAmount: number;
  currency: string;
  method: 'SIMULATED';
  status: PaymentStatus;
  reference?: string;
  failureReason?: string;
  processedAt?: string;
}

export interface VendorOrderView {
  _id: string;
  orderNumber: string;
  createdAt: string;
  paymentStatus: PaymentStatus;
  contact: OrderContact;
  shippingAddress: Address;
  fulfillment: VendorOrder;
}

export interface VendorProfile {
  _id: string;
  businessName: string;
  description?: string;
  logo?: string;
  contactEmail: string;
  phone?: string;
  address: Address;
  approvalStatus: VendorApprovalStatus;
  approvalNote?: string;
}

export interface VendorDashboard {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
}

export interface VendorSales {
  days: number;
  totalRevenue: number;
  totalOrders: number;
  daily: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
}

export interface AdminDashboard {
  users: number;
  vendors: number;
  pendingVendors: number;
  products: number;
  activeProducts: number;
  orders: number;
  revenue: number;
}

export interface AdminVendor extends VendorProfile {
  createdAt: string;
  owner?: { name: string; email: string; status: string };
}
