import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

// Pages
import { HomePage } from './pages/HomePage';
import { MenuPage } from './pages/MenuPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderTrackerPage } from './pages/OrderTrackerPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { KitchenPage } from './pages/KitchenPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [pageParam, setPageParam] = useState<string | undefined>(undefined);

  const handleNavigate = (page: string, param?: string) => {
    setCurrentPage(page);
    setPageParam(param);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream-100 text-charcoal-900">
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      <main className="flex-grow">
        {currentPage === 'home' && <HomePage onNavigate={handleNavigate} />}
        {currentPage === 'menu' && (
          <MenuPage initialCategory={pageParam} onNavigate={handleNavigate} />
        )}
        {currentPage === 'cart' && <CartPage onNavigate={handleNavigate} />}
        {currentPage === 'checkout' && <CheckoutPage onNavigate={handleNavigate} />}
        {currentPage === 'order-detail' && (
          <OrderTrackerPage orderId={pageParam || ''} onNavigate={handleNavigate} />
        )}
        {currentPage === 'orders' && <MyOrdersPage onNavigate={handleNavigate} />}
        {currentPage === 'reserve' && <ReservationsPage onNavigate={handleNavigate} />}
        {currentPage === 'reservations' && <MyReservationsPage onNavigate={handleNavigate} />}
        {currentPage === 'kitchen' && <KitchenPage onNavigate={handleNavigate} />}
        {currentPage === 'admin' && <AdminPage onNavigate={handleNavigate} />}
        {currentPage === 'login' && <LoginPage onNavigate={handleNavigate} />}
        {currentPage === 'register' && <RegisterPage onNavigate={handleNavigate} />}
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
