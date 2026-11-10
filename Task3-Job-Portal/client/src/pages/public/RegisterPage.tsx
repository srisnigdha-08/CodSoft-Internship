import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Field } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAction } from '../../hooks/useAction';
import { ROLE_HOME } from '../../lib/format';

type AccountRole = 'JOB_SEEKER' | 'EMPLOYER';

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { busy, errors, run } = useAction();
  const [role, setRole] = useState<AccountRole>(
    params.get('role') === 'EMPLOYER' ? 'EMPLOYER' : 'JOB_SEEKER',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const created = await register({ name, email, password, role });
      navigate(ROLE_HOME[created.role], { replace: true });
    }, 'Your account is ready.');
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={(event) => void submit(event)}>
        <h1>Create your account</h1>
        <p className="auth-sub">Choose how you will use Tidewater Jobs.</p>
        <div className="role-switch" role="radiogroup" aria-label="Account type">
          {(
            [
              ['JOB_SEEKER', 'I want a job'],
              ['EMPLOYER', 'I am hiring'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={role === value ? 'active' : ''}>
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
              />
              {label}
            </label>
          ))}
        </div>
        <Field label="Full name" error={errors.name}>
          <input
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field
          label="Password"
          error={errors.password}
          hint="At least 8 characters with uppercase, lowercase and a number."
        >
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="auth-alt">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
