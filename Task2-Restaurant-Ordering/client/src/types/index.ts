export type Role = 'CUSTOMER' | 'KITCHEN_STAFF' | 'ADMIN';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type OrderType = 'DINE_IN' | 'PICKUP' | 'DELIVERY';

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentMethod = 'CARD' | 'UPI' | 'CASH' | 'MOCK_ONLINE';

export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  createdAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: {
    items: number;
  };
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number | string;
  imageUrl: string;
  isVegetarian: boolean;
  isAvailable: boolean;
  preparationTimeMinutes: number;
  sortOrder: number;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface RestaurantTable {
  id: string;
  tableNumber: string;
  capacity: number;
  locationDescription?: string | null;
  isActive: boolean;
  _count?: {
    orders: number;
    reservations: number;
  };
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId?: string | null;
  name: string;
  price: number | string;
  quantity: number;
  subtotal: number | string;
  notes?: string | null;
  menuItem?: MenuItem | null;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  previousStatus?: OrderStatus | null;
  newStatus: OrderStatus;
  changedByUserId?: string | null;
  notes?: string | null;
  createdAt: string;
  changedBy?: {
    name: string;
    role: Role;
  } | null;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  orderId: string;
  amount: number | string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string | null;
  gatewayResponse?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderType: OrderType;
  tableId?: string | null;
  deliveryAddress?: string | null;
  status: OrderStatus;
  subtotal: number | string;
  tax: number | string;
  deliveryFee: number | string;
  totalAmount: number | string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payment?: Payment | null;
  table?: RestaurantTable | null;
  statusHistory?: OrderStatusHistory[];
}

export interface Reservation {
  id: string;
  reservationNumber: string;
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  tableId?: string | null;
  guestCount: number;
  reservationDate: string;
  reservationTime: string;
  status: ReservationStatus;
  specialRequests?: string | null;
  createdAt: string;
  table?: RestaurantTable | null;
  customer?: {
    name: string;
    email: string;
    phone?: string | null;
  } | null;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}
