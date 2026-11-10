import { useState, type FormEvent } from 'react';
import { errorText } from '../../api/client';
import { ErrorBanner } from '../../components/Feedback';
import { Field, PageHeader } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { authService } from '../../services';

export function ProfilePage() {
  const { session, refresh } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(session?.user.name ?? '');
  const [phone, setPhone] = useState(session?.user.phone ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await authService.updateProfile({ name, ...(phone ? { phone } : {}) });
      await refresh();
      toast('Profile updated');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <>
      <PageHeader title="Your profile" subtitle={session?.user.email} />
      <form className="card stack narrow" onSubmit={(e) => void submit(e)}>
        <ErrorBanner message={error} />
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <button type="submit" className="btn btn-primary">
          Save changes
        </button>
      </form>
    </>
  );
}
