import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Field } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAction } from '../../hooks/useAction';
import { ROLE_HOME } from '../../lib/format';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { busy, errors, run } = useAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const from = (location.state as { from?: string } | null)?.from;

  if (user) return <Navigate to={from ?? ROLE_HOME[user.role]} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const signedIn = await login(email, password);
      navigate(from ?? ROLE_HOME[signedIn.role], { replace: true });
    });
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={(event) => void submit(event)}>
        <h1>Welcome back</h1>
        <p className="auth-sub">Sign in to continue to your dashboard.</p>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" error={errors.password}>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="auth-alt">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
