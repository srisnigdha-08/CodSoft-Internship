import {
  User,
  MenuCategory,
  MenuItem,
  Order,
  Reservation,
  RestaurantTable,
  Payment,
  OrderStatus,
  Role,
} from '../types';

const API_BASE = '/api/v1';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data: T; message?: string }> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('dinedesk_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const body = await res.json();

  if (!res.ok) {
    const errorMsg = body.message || 'Request failed';
    const err: any = new Error(errorMsg);
    err.status = res.status;
    err.details = body.details;
    err.errors = body.errors;
    throw err;
  }

  return body;
}

export const api = {
  // Auth
  async register(data: any) {
    const res = await request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.data?.token) {
      localStorage.setItem('dinedesk_token', res.data.token);
    }
    return res.data;
  },

  async login(data: any) {
    const res = await request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.data?.token) {
      localStorage.setItem('dinedesk_token', res.data.token);
    }
    return res.data;
  },

  async logout() {
    localStorage.removeItem('dinedesk_token');
    return request('/auth/logout', { method: 'POST' });
  },

  async getMe() {
    const res = await request<{ user: User }>('/auth/me');
    return res.data.user;
  },

  // Menu & Categories
  async getCategories() {
    const res = await request<{ categories: MenuCategory[] }>('/categories');
    return res.data.categories;
  },

  async getMenuItems(params: {
    category?: string;
    search?: string;
    vegetarian?: boolean;
    available?: boolean;
  } = {}) {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.vegetarian !== undefined) query.set('vegetarian', String(params.vegetarian));
    if (params.available !== undefined) query.set('available', String(params.available));

    const res = await request<{ items: MenuItem[] }>(`/menu?${query.toString()}`);
    return res.data.items;
  },

  async getMenuItem(id: string) {
    const res = await request<{ item: MenuItem }>(`/menu/${id}`);
    return res.data.item;
  },

  async createMenuItem(data: any) {
    const res = await request<{ item: MenuItem }>('/menu', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data.item;
  },

  async updateMenuItem(id: string, data: any) {
    const res = await request<{ item: MenuItem }>(`/menu/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data.item;
  },

  async deleteMenuItem(id: string) {
    return request(`/menu/${id}`, { method: 'DELETE' });
  },

  // Orders
  async createOrder(data: any) {
    const res = await request<{ order: Order }>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data.order;
  },

  async getMyOrders(email?: string) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    const res = await request<{ orders: Order[] }>(`/orders/my${query}`);
    return res.data.orders;
  },

  async getOrder(id: string) {
    const res = await request<{ order: Order }>(`/orders/${id}`);
    return res.data.order;
  },

  async cancelOrder(id: string, reason?: string) {
    const res = await request<{ order: Order }>(`/orders/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    return res.data.order;
  },

  // Kitchen
  async getKitchenOrders(status?: OrderStatus) {
    const query = status ? `?status=${status}` : '';
    const res = await request<{ orders: Order[] }>(`/kitchen/orders${query}`);
    return res.data.orders;
  },

  async updateOrderStatus(id: string, status: OrderStatus, notes?: string) {
    const res = await request<{ order: Order }>(`/kitchen/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
    return res.data.order;
  },

  // Reservations
  async checkAvailability(params: { date: string; time: string; guestCount: number }) {
    const query = new URLSearchParams({
      date: params.date,
      time: params.time,
      guestCount: String(params.guestCount),
    });
    const res = await request<{
      available: boolean;
      availableTables: RestaurantTable[];
      totalCapacity: number;
    }>(`/reservations/availability?${query.toString()}`);
    return res.data;
  },

  async createReservation(data: any) {
    const res = await request<{ reservation: Reservation }>('/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data.reservation;
  },

  async getMyReservations(email?: string) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    const res = await request<{ reservations: Reservation[] }>(`/reservations/my${query}`);
    return res.data.reservations;
  },

  async getAllReservations(params: { date?: string; status?: string } = {}) {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.status) query.set('status', params.status);
    const res = await request<{ reservations: Reservation[] }>(`/reservations?${query.toString()}`);
    return res.data.reservations;
  },

  async updateReservationStatus(id: string, status: string, specialRequests?: string) {
    const res = await request<{ reservation: Reservation }>(`/reservations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, specialRequests }),
    });
    return res.data.reservation;
  },

  // Tables
  async getTables() {
    const res = await request<{ tables: RestaurantTable[] }>('/tables');
    return res.data.tables;
  },

  async createTable(data: any) {
    const res = await request<{ table: RestaurantTable }>('/tables', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data.table;
  },

  async updateTable(id: string, data: any) {
    const res = await request<{ table: RestaurantTable }>(`/tables/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data.table;
  },

  // Payments
  async processPaymentCheckout(data: {
    orderId: string;
    method: string;
    simulateFailure?: boolean;
  }) {
    const res = await request<{ payment: Payment }>('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data.payment;
  },

  async getPayment(id: string) {
    const res = await request<{ payment: Payment }>(`/payments/${id}`);
    return res.data.payment;
  },

  // Admin
  async getAdminStats() {
    const res = await request<{
      stats: {
        totalOrders: number;
        activeOrders: number;
        totalRevenue: number;
        todayReservations: number;
        totalCustomers: number;
        popularItems: { name: string; totalQuantity: number; totalRevenue: number }[];
      };
    }>('/admin/stats');
    return res.data.stats;
  },

  async getAdminOrders(params: { status?: string; search?: string; page?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    const res = await request<{ orders: Order[]; pagination: any }>(`/admin/orders?${query.toString()}`);
    return res.data;
  },

  async getAdminUsers() {
    const res = await request<{ users: any[] }>('/admin/users');
    return res.data.users;
  },

  async updateUserRole(id: string, role: Role) {
    const res = await request<{ user: User }>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    return res.data.user;
  },
};
