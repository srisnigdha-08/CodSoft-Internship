import { LogOut, Search, ShoppingCart, UserRound } from 'lucide-react';
import type { FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Mela Marketplace home">
      <img src="/favicon.svg" alt="" width={30} height={30} />
      <span>Mela</span>
    </Link>
  );
}

export function SessionControls() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  if (!session) {
    return (
      <div className="session-controls">
        <Link to="/login" className="btn btn-ghost btn-small">
          Sign in
        </Link>
        <Link to="/register" className="btn btn-accent btn-small">
          Join
        </Link>
      </div>
    );
  }
  return (
    <div className="session-controls">
      <span className="session-name">
        <UserRound size={16} aria-hidden="true" /> {session.user.name}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-small"
        onClick={() => void logout().then(() => navigate('/'))}
      >
        <LogOut size={15} aria-hidden="true" /> Sign out
      </button>
    </div>
  );
}

function RoleLinks() {
  const { session } = useAuth();
  const { cart } = useCart();
  const role = session?.user.role;
  if (role === 'ADMIN') return <NavLink to="/admin">Admin</NavLink>;
  if (role === 'VENDOR') return <NavLink to="/vendor">Vendor hub</NavLink>;
  if (role !== 'CUSTOMER') return null;
  return (
    <>
      <NavLink to="/customer/orders">Orders</NavLink>
      <NavLink to="/customer/profile">Profile</NavLink>
      <NavLink to="/customer/cart" className="cart-link" aria-label={`Cart, ${cart?.itemCount ?? 0} items`}>
        <ShoppingCart size={18} aria-hidden="true" />
        <span className="cart-count">{cart?.itemCount ?? 0}</span>
      </NavLink>
    </>
  );
}

export function StoreLayout() {
  const navigate = useNavigate();

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    navigate(query ? `/products?q=${encodeURIComponent(query)}` : '/products');
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Brand />
          <form className="header-search" role="search" onSubmit={search}>
            <input name="q" type="search" placeholder="Search products" aria-label="Search products" />
            <button type="submit" aria-label="Search">
              <Search size={17} aria-hidden="true" />
            </button>
          </form>
          <nav className="main-nav" aria-label="Main">
            <NavLink to="/products">Shop</NavLink>
            <NavLink to="/vendors">Stores</NavLink>
            <RoleLinks />
          </nav>
          <SessionControls />
        </div>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <p>Mela is a demonstration marketplace. Stores and products are fictional and payments are simulated.</p>
      </footer>
    </div>
  );
}
