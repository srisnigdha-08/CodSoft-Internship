import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorText } from '../api/client';
import { ErrorBanner } from '../components/Feedback';
import { Field } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { homePathFor } from '../utils/format';

const DEMO_LOGINS = [
  ['Customer', 'customer@example.com', 'Customer@12345'],
  ['Vendor A', 'vendor1@example.com', 'Vendor@12345'],
  ['Vendor B', 'vendor2@example.com', 'Vendor@12345'],
  ['Admin', 'admin@example.com', 'Admin@12345'],
];

export function LoginPage() {
  const { login, session, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && session && !busy) return <Navigate to={from ?? homePathFor(session.user.role)} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await login(email, password);
      navigate(from ?? homePathFor(next.user.role), { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={(e) => void submit(e)}>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to shop, sell or manage the marketplace.</p>
        <ErrorBanner message={error} />
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted small center">
          New here? <Link to="/register">Create an account</Link>
        </p>
        {import.meta.env.DEV && (
          <div className="demo-logins">
            <span className="muted small">Fill a demo account</span>
            <div>
              {DEMO_LOGINS.map(([label, demoEmail, demoPassword]) => (
                <button
                  key={label}
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => {
                    setEmail(demoEmail);
                    setPassword(demoPassword);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
