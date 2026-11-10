import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_HOME } from '../lib/format';

export function Logo() {
  return (
    <Link to="/" className="logo">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#12343b" />
        <path d="M6 19c3-4 6-4 10 0s7 4 10 0" fill="none" stroke="#f2b84b" strokeWidth="3" strokeLinecap="round" />
        <path d="M6 12c3-4 6-4 10 0s7 4 10 0" fill="none" stroke="#7fd1c7" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span>Tidewater Jobs</span>
    </Link>
  );
}

export function Navbar() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    try {
      await logout();
      toast.success('You have been signed out.');
      navigate('/');
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Logo />
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-label="Toggle navigation"
          onClick={() => setOpen((value) => !value)}
        >
          ☰
        </button>
        <nav className={`nav-links ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          <NavLink to="/jobs">Find Jobs</NavLink>
          {user ? (
            <>
              <NavLink to={ROLE_HOME[user.role]}>Dashboard</NavLink>
              <span className="nav-user">{user.name}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Sign in</NavLink>
              <Link to="/register" className="btn btn-primary btn-sm">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
