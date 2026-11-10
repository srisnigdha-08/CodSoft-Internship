import {
  Boxes,
  ChartColumn,
  Gauge,
  Package,
  ReceiptText,
  Store,
  Tags,
  Users,
  Warehouse,
} from 'lucide-react';
import { Route, Routes } from 'react-router-dom';
import { DashboardLayout, type DashboardLink } from '../layouts/DashboardLayout';
import { StoreLayout } from '../layouts/StoreLayout';
import { AdminCategoriesPage } from '../pages/admin/AdminCategoriesPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminOrderDetailsPage } from '../pages/admin/AdminOrderDetailsPage';
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminVendorsPage } from '../pages/admin/AdminVendorsPage';
import { CartPage } from '../pages/customer/CartPage';
import { CheckoutPage } from '../pages/customer/CheckoutPage';
import { OrderDetailsPage } from '../pages/customer/OrderDetailsPage';
import { OrdersPage } from '../pages/customer/OrdersPage';
import { PaymentPage } from '../pages/customer/PaymentPage';
import { ProfilePage } from '../pages/customer/ProfilePage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProductDetailsPage } from '../pages/ProductDetailsPage';
import { ProductsPage } from '../pages/ProductsPage';
import { RegisterPage } from '../pages/RegisterPage';
import { VendorsPage } from '../pages/VendorsPage';
import { VendorStorePage } from '../pages/VendorStorePage';
import { VendorDashboardPage } from '../pages/vendor/VendorDashboardPage';
import { VendorInventoryPage } from '../pages/vendor/VendorInventoryPage';
import { VendorOrdersPage } from '../pages/vendor/VendorOrdersPage';
import { VendorProductFormPage } from '../pages/vendor/VendorProductFormPage';
import { VendorProductsPage } from '../pages/vendor/VendorProductsPage';
import { VendorProfilePage } from '../pages/vendor/VendorProfilePage';
import { VendorSalesPage } from '../pages/vendor/VendorSalesPage';
import { ProtectedRoute } from './ProtectedRoute';

const vendorLinks: DashboardLink[] = [
  { to: '/vendor', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/vendor/products', label: 'Products', icon: Package },
  { to: '/vendor/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/vendor/orders', label: 'Orders', icon: ReceiptText },
  { to: '/vendor/sales', label: 'Sales', icon: ChartColumn },
  { to: '/vendor/profile', label: 'Profile', icon: Store },
];

const adminLinks: DashboardLink[] = [
  { to: '/admin', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/admin/vendors', label: 'Vendors', icon: Store },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/products', label: 'Products', icon: Boxes },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailsPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="vendors/:id" element={<VendorStorePage />} />
        <Route path="customer" element={<ProtectedRoute role="CUSTOMER" />}>
          <Route index element={<OrdersPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailsPage />} />
          <Route path="orders/:id/pay" element={<PaymentPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="vendor" element={<ProtectedRoute role="VENDOR" />}>
        <Route element={<DashboardLayout title="Vendor hub" links={vendorLinks} />}>
          <Route index element={<VendorDashboardPage />} />
          <Route path="products" element={<VendorProductsPage />} />
          <Route path="products/new" element={<VendorProductFormPage />} />
          <Route path="products/:id/edit" element={<VendorProductFormPage />} />
          <Route path="inventory" element={<VendorInventoryPage />} />
          <Route path="orders" element={<VendorOrdersPage />} />
          <Route path="sales" element={<VendorSalesPage />} />
          <Route path="profile" element={<VendorProfilePage />} />
        </Route>
      </Route>

      <Route path="admin" element={<ProtectedRoute role="ADMIN" />}>
        <Route element={<DashboardLayout title="Admin console" links={adminLinks} />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="vendors" element={<AdminVendorsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
