import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  UtensilsCrossed,
  ShoppingBag,
  CalendarDays,
  Clock,
  LayoutDashboard,
  ChefHat,
  User,
  LogOut,
  Menu as MenuIcon,
  X,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string, param?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const { user, logout, quickLogin } = useAuth();
  const { itemCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'menu', label: 'Digital Menu' },
    { id: 'reserve', label: 'Reservations' },
    { id: 'orders', label: 'My Orders' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-cream-50/95 backdrop-blur-md border-b border-cream-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => onNavigate('home')}
          >
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-terracotta-600 to-amber-600 flex items-center justify-center text-white shadow-md shadow-terracotta-500/20 group-hover:scale-105 transition-transform duration-200">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display text-2xl font-bold tracking-tight text-charcoal-900 group-hover:text-terracotta-700 transition-colors">
                DineDesk
              </span>
              <span className="hidden sm:block text-[10px] tracking-widest uppercase font-semibold text-terracotta-700/80 -mt-1">
                Artisanal Restaurant & Bar
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-terracotta-700 text-white shadow-sm'
                      : 'text-charcoal-800 hover:text-terracotta-700 hover:bg-cream-200/60'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            {/* Kitchen Link (Staff & Admin) */}
            {user && (user.role === 'KITCHEN_STAFF' || user.role === 'ADMIN') && (
              <button
                onClick={() => onNavigate('kitchen')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  currentPage === 'kitchen'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-800 bg-amber-100/70 hover:bg-amber-200/80'
                }`}
              >
                <ChefHat className="w-4 h-4" />
                <span>Kitchen KDS</span>
              </button>
            )}

            {/* Admin Link */}
            {user && user.role === 'ADMIN' && (
              <button
                onClick={() => onNavigate('admin')}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  currentPage === 'admin'
                    ? 'bg-charcoal-900 text-white shadow-sm'
                    : 'text-charcoal-800 bg-stone-200/80 hover:bg-stone-300'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Right Action Icons: Cart & User */}
          <div className="flex items-center space-x-3">
            {/* Cart Button */}
            <button
              onClick={() => onNavigate('cart')}
              className="relative p-2.5 rounded-full text-charcoal-800 hover:text-terracotta-700 hover:bg-cream-200/60 transition-colors"
              aria-label="View shopping cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-terracotta-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {itemCount}
                </span>
              )}
            </button>

            {/* User Dropdown / Auth */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-2 pl-2 pr-3 py-1.5 rounded-full border border-cream-300 bg-white hover:bg-cream-50 transition-colors shadow-sm"
                >
                  <div className="w-7 h-7 rounded-full bg-terracotta-100 text-terracotta-700 font-bold text-xs flex items-center justify-center">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-xs font-semibold text-charcoal-800 truncate max-w-[100px]">
                    {user.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream-200 font-mono text-charcoal-800">
                    {user.role}
                  </span>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-cream-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-2 border-b border-cream-200/60">
                      <p className="text-xs font-bold text-charcoal-900">{user.name}</p>
                      <p className="text-[11px] text-stone-500 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onNavigate('orders');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-charcoal-800 hover:bg-cream-100 flex items-center space-x-2"
                    >
                      <Clock className="w-3.5 h-3.5 text-terracotta-600" />
                      <span>Order History</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onNavigate('reservations');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-charcoal-800 hover:bg-cream-100 flex items-center space-x-2"
                    >
                      <CalendarDays className="w-3.5 h-3.5 text-terracotta-600" />
                      <span>My Reservations</span>
                    </button>
                    {(user.role === 'KITCHEN_STAFF' || user.role === 'ADMIN') && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onNavigate('kitchen');
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-amber-800 hover:bg-amber-50 flex items-center space-x-2"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Kitchen Dashboard</span>
                      </button>
                    )}
                    {user.role === 'ADMIN' && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onNavigate('admin');
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-charcoal-900 hover:bg-stone-100 flex items-center space-x-2"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        <span>Admin Dashboard</span>
                      </button>
                    )}
                    <div className="border-t border-cream-200/60 mt-1 pt-1">
                      <button
                        onClick={async () => {
                          setUserDropdownOpen(false);
                          await logout();
                          onNavigate('home');
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onNavigate('login')}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-charcoal-800 hover:text-terracotta-700 hover:bg-cream-200 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onNavigate('register')}
                  className="hidden sm:inline-block px-4 py-2 rounded-full text-xs font-semibold bg-terracotta-700 text-white hover:bg-terracotta-800 transition-all shadow-sm"
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-charcoal-800 hover:bg-cream-200"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Quick Demo Switcher Bar */}
        <div className="hidden sm:flex items-center justify-between py-1.5 px-3 bg-cream-200/50 rounded-lg text-xs border border-cream-300/40 text-stone-600 mb-2">
          <span className="flex items-center space-x-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Fast Role Switcher (One-Click Demo):</span>
          </span>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => quickLogin('CUSTOMER')}
              className="px-2.5 py-0.5 rounded bg-white hover:bg-cream-50 border border-cream-300 font-semibold text-stone-700 hover:text-terracotta-700 transition-colors"
            >
              Customer
            </button>
            <button
              onClick={() => quickLogin('KITCHEN_STAFF')}
              className="px-2.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 font-semibold text-amber-800 transition-colors"
            >
              Kitchen Staff
            </button>
            <button
              onClick={() => quickLogin('ADMIN')}
              className="px-2.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 border border-stone-300 font-semibold text-stone-900 transition-colors"
            >
              Administrator
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-cream-200 bg-white px-4 pt-3 pb-6 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate(item.id);
              }}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${
                currentPage === item.id
                  ? 'bg-terracotta-700 text-white'
                  : 'text-charcoal-800 hover:bg-cream-100'
              }`}
            >
              {item.label}
            </button>
          ))}
          {user && (user.role === 'KITCHEN_STAFF' || user.role === 'ADMIN') && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('kitchen');
              }}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-100 text-amber-800 flex items-center space-x-2"
            >
              <ChefHat className="w-4 h-4" />
              <span>Kitchen Display Dashboard</span>
            </button>
          )}
          {user && user.role === 'ADMIN' && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('admin');
              }}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold bg-stone-200 text-stone-900 flex items-center space-x-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Admin Management Dashboard</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
