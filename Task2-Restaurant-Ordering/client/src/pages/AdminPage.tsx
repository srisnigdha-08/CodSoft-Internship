import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  MenuItem,
  MenuCategory,
  Order,
  Reservation,
  RestaurantTable,
  User,
  Role,
  OrderStatus,
} from '../types';
import {
  LayoutDashboard,
  Utensils,
  ShoppingBag,
  CalendarDays,
  Users,
  Plus,
  Trash2,
  Edit,
  DollarSign,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  X,
  Search,
} from 'lucide-react';

interface AdminPageProps {
  onNavigate: (page: string, param?: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'MENU' | 'ORDERS' | 'RESERVATIONS' | 'TABLES' | 'USERS'
  >('OVERVIEW');

  // Stats
  const [stats, setStats] = useState<any>(null);

  // Menu State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');

  // Reservations State
  const [reservations, setReservations] = useState<Reservation[]>([]);

  // Tables State
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [newTableDesc, setNewTableDesc] = useState('');

  // Users State
  const [usersList, setUsersList] = useState<any[]>([]);

  // Loading
  const [loading, setLoading] = useState(true);

  // Form states for creating/editing menu item
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    categoryId: '',
    description: '',
    price: 250,
    imageUrl: '',
    isVegetarian: true,
    isAvailable: true,
    preparationTimeMinutes: 15,
  });

  async function loadData() {
    setLoading(true);
    try {
      const [statsData, menuData, catsData, ordersData, resData, tablesData, usersData] =
        await Promise.all([
          api.getAdminStats(),
          api.getMenuItems(),
          api.getCategories(),
          api.getAdminOrders(),
          api.getAllReservations(),
          api.getTables(),
          api.getAdminUsers(),
        ]);

      setStats(statsData);
      setMenuItems(menuData);
      setCategories(catsData);
      setOrders(ordersData.orders);
      setReservations(resData);
      setTables(tablesData);
      setUsersList(usersData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Menu Handlers
  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const updated = await api.updateMenuItem(item.id, {
        isAvailable: !item.isAvailable,
      });
      setMenuItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (err: any) {
      alert(err.message || 'Failed to update item availability');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Delete this menu item?')) return;
    try {
      await api.deleteMenuItem(id);
      setMenuItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const updated = await api.updateMenuItem(editingItem.id, formData);
        setMenuItems((prev) => prev.map((i) => (i.id === editingItem.id ? updated : i)));
      } else {
        const created = await api.createMenuItem(formData);
        setMenuItems((prev) => [...prev, created]);
      }
      setIsItemModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save menu item');
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      slug: '',
      categoryId: categories[0]?.id || '',
      description: '',
      price: 250,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      isVegetarian: true,
      isAvailable: true,
      preparationTimeMinutes: 15,
    });
    setIsItemModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      slug: item.slug,
      categoryId: item.categoryId,
      description: item.description,
      price: Number(item.price),
      imageUrl: item.imageUrl,
      isVegetarian: item.isVegetarian,
      isAvailable: item.isAvailable,
      preparationTimeMinutes: item.preparationTimeMinutes,
    });
    setIsItemModalOpen(true);
  };

  // Table Creation Handler
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber) return;
    try {
      const created = await api.createTable({
        tableNumber: newTableNumber.trim(),
        capacity: newTableCapacity,
        locationDescription: newTableDesc.trim() || null,
        isActive: true,
      });
      setTables((prev) => [...prev, created]);
      setNewTableNumber('');
      setNewTableDesc('');
    } catch (err: any) {
      alert(err.message || 'Failed to create table');
    }
  };

  // Role Management Handler
  const handleUpdateRole = async (userId: string, newRole: Role) => {
    try {
      await api.updateUserRole(userId, newRole);
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    }
  };

  // Guard: if user is not ADMIN, show notice
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
        <h2 className="font-display text-2xl font-bold">Admin Portal Restricted</h2>
        <p className="text-xs text-stone-500">
          This portal requires administrator privileges. Please log in with the administrator account.
        </p>
        <button
          onClick={() => onNavigate('login')}
          className="px-5 py-2.5 rounded-full bg-charcoal-900 text-white text-xs font-bold"
        >
          Administrator Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cream-200">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-charcoal-900 text-white flex items-center justify-center shadow-md">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-charcoal-900">
              Admin Control Center
            </h1>
            <p className="text-xs text-stone-500">
              Operational analytics, catalog governance, and restaurant administration
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="px-4 py-2 rounded-full bg-cream-200 hover:bg-cream-300 text-charcoal-900 text-xs font-bold transition-colors self-start sm:self-center"
        >
          Refresh Ledger
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none border-b border-cream-200">
        {[
          { id: 'OVERVIEW', label: 'Overview Metrics', icon: TrendingUp },
          { id: 'MENU', label: `Menu Items (${menuItems.length})`, icon: Utensils },
          { id: 'ORDERS', label: `Orders (${orders.length})`, icon: ShoppingBag },
          { id: 'RESERVATIONS', label: `Reservations (${reservations.length})`, icon: CalendarDays },
          { id: 'TABLES', label: `Tables (${tables.length})`, icon: Utensils },
          { id: 'USERS', label: `Users & Roles (${usersList.length})`, icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? 'bg-charcoal-900 text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-cream-200 hover:text-charcoal-900 border border-cream-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW METRICS */}
      {activeTab === 'OVERVIEW' && stats && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase text-stone-500">Total Revenue</span>
              <p className="font-display text-3xl font-bold text-terracotta-700">
                ₹{Number(stats.totalRevenue).toFixed(2)}
              </p>
              <span className="text-[11px] text-emerald-600 font-semibold">From completed orders</span>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase text-stone-500">Active Kitchen Orders</span>
              <p className="font-display text-3xl font-bold text-charcoal-900">
                {stats.activeOrders}
              </p>
              <span className="text-[11px] text-amber-700 font-semibold">In prep & ready queue</span>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase text-stone-500">Today's Reservations</span>
              <p className="font-display text-3xl font-bold text-charcoal-900">
                {stats.todayReservations}
              </p>
              <span className="text-[11px] text-blue-600 font-semibold">Booked for today</span>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase text-stone-500">Registered Customers</span>
              <p className="font-display text-3xl font-bold text-charcoal-900">
                {stats.totalCustomers}
              </p>
              <span className="text-[11px] text-stone-500 font-semibold">Profiles in database</span>
            </div>
          </div>

          {/* Popular Dishes Breakdown */}
          <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-4">
            <h3 className="font-display text-lg font-bold text-charcoal-900">
              Top Selling Dishes by Volume
            </h3>
            <div className="divide-y divide-cream-100">
              {stats.popularItems && stats.popularItems.length > 0 ? (
                stats.popularItems.map((item: any, idx: number) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs">
                    <span className="font-bold text-charcoal-900">{item.name}</span>
                    <div className="flex items-center space-x-6">
                      <span className="text-stone-500">{item.totalQuantity} ordered</span>
                      <span className="font-bold text-terracotta-700">₹{Number(item.totalRevenue).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-stone-400 py-3">No dish sales recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MENU ITEMS GOVERNANCE */}
      {activeTab === 'MENU' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-charcoal-900">
                Menu Catalog Management
              </h2>
              <p className="text-xs text-stone-500">
                Add, edit, change pricing, and toggle dish availability in PostgreSQL
              </p>
            </div>

            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 rounded-full bg-terracotta-700 hover:bg-terracotta-800 text-white font-bold text-xs flex items-center space-x-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Dish</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-cream-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream-100 text-stone-600 uppercase font-bold text-[11px] border-b border-cream-200">
                  <tr>
                    <th className="p-4">Dish</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Dietary</th>
                    <th className="p-4">Availability</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {menuItems.map((item) => (
                    <tr key={item.id} className="hover:bg-cream-50/50">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover"
                          />
                          <div>
                            <p className="font-bold text-charcoal-900">{item.name}</p>
                            <p className="text-[10px] text-stone-500 line-clamp-1 max-w-xs">{item.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-stone-700">
                        {item.category?.name || 'Category'}
                      </td>
                      <td className="p-4 font-display font-bold text-charcoal-900">
                        ₹{Number(item.price).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.isVegetarian
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.isVegetarian ? 'VEG' : 'NON-VEG'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                            item.isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : 'bg-stone-100 text-stone-500 border border-stone-300'
                          }`}
                        >
                          {item.isAvailable ? 'Available' : 'Sold Out'}
                        </button>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg text-stone-600 hover:bg-cream-200"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MASTER ORDERS TABLE */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-charcoal-900">
              Orders Ledger
            </h2>
          </div>

          <div className="bg-white rounded-3xl border border-cream-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream-100 text-stone-600 uppercase font-bold text-[11px] border-b border-cream-200">
                  <tr>
                    <th className="p-4">Order #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-cream-50/50">
                      <td className="p-4 font-bold text-charcoal-900">
                        <button
                          onClick={() => onNavigate('order-detail', o.id)}
                          className="hover:text-terracotta-700 underline font-mono"
                        >
                          {o.orderNumber}
                        </button>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-charcoal-900">{o.customerName}</p>
                        <p className="text-[10px] text-stone-500">{o.customerEmail}</p>
                      </td>
                      <td className="p-4 font-semibold text-stone-700">
                        {o.orderType}
                      </td>
                      <td className="p-4 font-display font-bold text-charcoal-900">
                        ₹{Number(o.totalAmount).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.payment?.status === 'SUCCESSFUL'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {o.payment?.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-800">
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RESERVATIONS MASTER */}
      {activeTab === 'RESERVATIONS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-charcoal-900">
              Table Bookings Ledger
            </h2>
          </div>

          <div className="bg-white rounded-3xl border border-cream-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream-100 text-stone-600 uppercase font-bold text-[11px] border-b border-cream-200">
                  <tr>
                    <th className="p-4">Booking #</th>
                    <th className="p-4">Guest</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Guests</th>
                    <th className="p-4">Table</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {reservations.map((r) => (
                    <tr key={r.id} className="hover:bg-cream-50/50">
                      <td className="p-4 font-mono font-bold text-charcoal-900">
                        #{r.reservationNumber}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-charcoal-900">{r.customerName}</p>
                        <p className="text-[10px] text-stone-500">{r.customerPhone}</p>
                      </td>
                      <td className="p-4 font-semibold text-stone-800">
                        {r.reservationDate} at {r.reservationTime}
                      </td>
                      <td className="p-4">{r.guestCount} Persons</td>
                      <td className="p-4 font-bold text-terracotta-700">
                        {r.table ? `${r.table.tableNumber}` : 'Auto-Allocate'}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TABLES MANAGEMENT */}
      {activeTab === 'TABLES' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 border border-cream-200 shadow-sm space-y-4">
            <h3 className="font-display text-lg font-bold text-charcoal-900">
              Add New Dining Table
            </h3>
            <form onSubmit={handleCreateTable} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
                  Table Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-07"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-cream-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
                  Capacity (Guests)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-cream-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase mb-1">
                  Area Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Garden Terrace"
                  value={newTableDesc}
                  onChange={(e) => setNewTableDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-cream-300 text-xs"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-4 rounded-xl bg-terracotta-700 hover:bg-terracotta-800 text-white font-bold text-xs"
              >
                Create Table
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {tables.map((tbl) => (
              <div
                key={tbl.id}
                className="bg-white rounded-2xl p-4 border border-cream-200 shadow-xs text-center space-y-2"
              >
                <span className="font-display text-2xl font-bold text-charcoal-900 block">
                  {tbl.tableNumber}
                </span>
                <p className="text-xs text-stone-600 font-semibold">{tbl.capacity} Seats</p>
                <p className="text-[10px] text-stone-400 line-clamp-1">{tbl.locationDescription || 'Dining Area'}</p>
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: USERS AND ROLE PROMOTION */}
      {activeTab === 'USERS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-charcoal-900">
              User Access & Role Governance
            </h2>
          </div>

          <div className="bg-white rounded-3xl border border-cream-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream-100 text-stone-600 uppercase font-bold text-[11px] border-b border-cream-200">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Orders</th>
                    <th className="p-4">Reservations</th>
                    <th className="p-4">Current Role</th>
                    <th className="p-4">Change Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-cream-50/50">
                      <td className="p-4 font-bold text-charcoal-900">{u.name}</td>
                      <td className="p-4 font-mono text-stone-500">{u.email}</td>
                      <td className="p-4">{u._count?.orders || 0}</td>
                      <td className="p-4">{u._count?.reservations || 0}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-charcoal-900 text-white'
                              : u.role === 'KITCHEN_STAFF'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-cream-200 text-stone-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value as Role)}
                          className="px-2 py-1 rounded border border-cream-300 text-xs font-semibold"
                        >
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="KITCHEN_STAFF">KITCHEN_STAFF</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal (Create or Edit) */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-cream-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream-100">
              <h3 className="font-display text-lg font-bold text-charcoal-900">
                {editingItem ? 'Edit Menu Dish' : 'Add New Menu Dish'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 rounded-full hover:bg-cream-200 text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-600 uppercase mb-1">Dish Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-cream-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-600 uppercase mb-1">Slug *</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-cream-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-600 uppercase mb-1">Category *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-cream-300 text-xs font-semibold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-600 uppercase mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-cream-300 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-600 uppercase mb-1">Description *</label>
                <textarea
                  rows={2}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-cream-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-600 uppercase mb-1">Image URL *</label>
                <input
                  type="url"
                  required
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-cream-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isVegetarian}
                    onChange={(e) => setFormData({ ...formData, isVegetarian: e.target.checked })}
                    className="rounded text-terracotta-600"
                  />
                  <span className="font-semibold text-stone-700">Pure Vegetarian</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                    className="rounded text-terracotta-600"
                  />
                  <span className="font-semibold text-stone-700">Currently Available</span>
                </label>
              </div>

              <div className="pt-3 border-t border-cream-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-cream-300 text-stone-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-terracotta-700 hover:bg-terracotta-800 text-white font-bold"
                >
                  Save Dish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
