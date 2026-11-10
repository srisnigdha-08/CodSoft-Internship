import { api, type Query } from '../api/client';
import type {
  Address,
  AdminDashboard,
  AdminVendor,
  Cart,
  Category,
  Order,
  Paginated,
  Payment,
  Product,
  PublicVendor,
  Review,
  Session,
  User,
  VendorApprovalStatus,
  VendorDashboard,
  VendorOrderStatus,
  VendorOrderView,
  VendorProfile,
  VendorSales,
} from '../types';

export interface RegisterInput {
  accountType: 'CUSTOMER' | 'VENDOR';
  name: string;
  email: string;
  password: string;
  phone?: string;
  vendor?: { businessName: string; description?: string; address: Address };
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  sku: string;
  categoryId: string;
  images: string[];
  isActive: boolean;
  stock?: number;
}

export interface ShippingInput {
  fullName: string;
  phone: string;
  address: Address;
}

export const authService = {
  me: () => api<Session>('/auth/me'),
  login: (email: string, password: string) =>
    api<Session>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (input: RegisterInput) => api<Session>('/auth/register', { method: 'POST', body: input }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  updateProfile: (body: { name?: string; phone?: string }) =>
    api<{ user: User }>('/users/me', { method: 'PATCH', body }),
};

export const catalogService = {
  categories: () => api<{ items: Category[] }>('/categories').then((r) => r.items),
  products: (query: Query) => api<Paginated<Product>>('/products', { query }),
  product: (id: string) => api<{ product: Product }>(`/products/${id}`).then((r) => r.product),
  reviews: (id: string) => api<Paginated<Review>>(`/products/${id}/reviews`, { query: { limit: 48 } }),
  reviewEligibility: (id: string) =>
    api<{ canReview: boolean; hasReviewed: boolean }>(`/products/${id}/review-eligibility`),
  createReview: (body: { productId: string; rating: number; title?: string; comment: string }) =>
    api('/reviews', { method: 'POST', body }),
  vendors: () => api<Paginated<PublicVendor>>('/vendors', { query: { limit: 48 } }),
  vendor: (id: string) => api<{ vendor: PublicVendor }>(`/vendors/${id}`).then((r) => r.vendor),
};

const unwrapCart = (r: { cart: Cart }) => r.cart;

export const cartService = {
  get: () => api<{ cart: Cart }>('/cart').then(unwrapCart),
  add: (productId: string, quantity: number) =>
    api<{ cart: Cart }>('/cart/items', { method: 'POST', body: { productId, quantity } }).then(unwrapCart),
  update: (productId: string, quantity: number) =>
    api<{ cart: Cart }>(`/cart/items/${productId}`, { method: 'PATCH', body: { quantity } }).then(unwrapCart),
  remove: (productId: string) =>
    api<{ cart: Cart }>(`/cart/items/${productId}`, { method: 'DELETE' }).then(unwrapCart),
};

export const orderService = {
  place: (body: ShippingInput) =>
    api<{ order: Order }>('/orders', { method: 'POST', body }).then((r) => r.order),
  list: (query: Query) => api<Paginated<Order>>('/orders', { query }),
  get: (id: string) => api<{ order: Order; payment: Payment | null }>(`/orders/${id}`),
  cancel: (id: string) => api<{ order: Order }>(`/orders/${id}/cancel`, { method: 'POST' }),
  simulatePayment: (orderId: string, outcome: 'SUCCESS' | 'FAILURE') =>
    api<{ label: string; payment: Payment; order: Order }>('/payments/simulate', {
      method: 'POST',
      body: { orderId, outcome },
    }),
};

export const vendorService = {
  profile: () => api<{ vendor: VendorProfile }>('/vendors/me').then((r) => r.vendor),
  updateProfile: (body: Partial<VendorProfile>) =>
    api<{ vendor: VendorProfile }>('/vendors/me', { method: 'PATCH', body }).then((r) => r.vendor),
  dashboard: () => api<VendorDashboard>('/vendors/me/dashboard'),
  sales: (days: number) => api<VendorSales>('/vendors/me/sales', { query: { days } }),
  products: (query: Query) => api<Paginated<Product>>('/vendors/me/products', { query }),
  product: (id: string) => api<{ product: Product }>(`/vendors/me/products/${id}`).then((r) => r.product),
  createProduct: (body: ProductInput) => api('/products', { method: 'POST', body }),
  updateProduct: (id: string, body: Partial<ProductInput>) =>
    api(`/products/${id}`, { method: 'PATCH', body }),
  deactivateProduct: (id: string) => api<void>(`/products/${id}`, { method: 'DELETE' }),
  adjustStock: (id: string, adjustment: number) =>
    api(`/products/${id}/stock`, { method: 'PATCH', body: { adjustment } }),
  orders: (query: Query) => api<Paginated<VendorOrderView>>('/vendors/me/orders', { query }),
  updateOrderStatus: (orderId: string, status: VendorOrderStatus) =>
    api(`/vendors/me/orders/${orderId}/status`, { method: 'PATCH', body: { status } }),
};

export const adminService = {
  dashboard: () => api<AdminDashboard>('/admin/dashboard'),
  vendors: (query: Query) => api<Paginated<AdminVendor>>('/admin/vendors', { query }),
  setVendorStatus: (id: string, status: VendorApprovalStatus) =>
    api(`/admin/vendors/${id}/status`, { method: 'PATCH', body: { status } }),
  users: (query: Query) => api<Paginated<User>>('/admin/users', { query }),
  updateUser: (id: string, body: { role?: 'CUSTOMER' | 'ADMIN'; status?: User['status'] }) =>
    api(`/admin/users/${id}`, { method: 'PATCH', body }),
  categories: () => api<{ items: Category[] }>('/admin/categories').then((r) => r.items),
  createCategory: (body: { name: string; description: string }) =>
    api('/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: Partial<Pick<Category, 'name' | 'description' | 'isActive'>>) =>
    api(`/categories/${id}`, { method: 'PATCH', body }),
  products: (query: Query) => api<Paginated<Product>>('/admin/products', { query }),
  setProductActive: (id: string, isActive: boolean) =>
    api(`/products/${id}`, { method: 'PATCH', body: { isActive } }),
  orders: (query: Query) => api<Paginated<Order>>('/admin/orders', { query }),
};
