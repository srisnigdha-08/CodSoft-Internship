import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from '../components/Feedback';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types';
import { homePathFor } from '../utils/format';

/** A convenience for navigation only. The API authorizes every request itself. */
export function ProtectedRoute({ role }: { role: Role }) {
  const { session, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Spinner label="Checking your session" />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (session.user.role !== role) return <Navigate to={homePathFor(session.user.role)} replace />;
  return <Outlet />;
}
