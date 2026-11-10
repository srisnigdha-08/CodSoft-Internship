import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorText } from '../api/client';
import { AddressFields, cleanAddress, emptyAddress } from '../components/AddressFields';
import { ErrorBanner } from '../components/Feedback';
import { Field } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { homePathFor } from '../utils/format';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState(emptyAddress);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await register({
        accountType,
        name,
        email,
        password,
        ...(accountType === 'VENDOR'
          ? { vendor: { businessName, description, address: cleanAddress(address) } }
          : {}),
      });
      navigate(homePathFor(session.user.role), { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={(e) => void submit(e)}>
        <h1>Create your account</h1>
        <div className="segmented" role="radiogroup" aria-label="Account type">
          {(['CUSTOMER', 'VENDOR'] as const).map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={accountType === type}
              className={accountType === type ? 'active' : ''}
              onClick={() => setAccountType(type)}
            >
              {type === 'CUSTOMER' ? 'I want to shop' : 'I want to sell'}
            </button>
          ))}
        </div>
        <ErrorBanner message={error} />
        <Field label="Full name">
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 8 characters with upper case, lower case and a digit.">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </Field>
        {accountType === 'VENDOR' && (
          <>
            <p className="muted small">New stores can sell once an administrator approves them.</p>
            <Field label="Business name">
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required minLength={2} />
            </Field>
            <Field label="About your store">
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <AddressFields value={address} onChange={setAddress} />
          </>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted small center">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
