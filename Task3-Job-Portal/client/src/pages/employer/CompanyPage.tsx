import { useCallback, useState, type FormEvent } from 'react';
import { employerApi } from '../../api';
import { AsyncView, Field, PageHeader } from '../../components/ui';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import type { EmployerProfile } from '../../types';

function CompanyForm({ profile, onSaved }: { profile: EmployerProfile; onSaved: () => void }) {
  const { busy, errors, run } = useAction();
  const [form, setForm] = useState({
    name: profile.company?.name ?? '',
    website: profile.company?.website ?? '',
    industry: profile.company?.industry ?? '',
    size: profile.company?.size ?? '',
    location: profile.company?.location ?? '',
    description: profile.company?.description ?? '',
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(() => employerApi.saveCompany(form), 'Company profile saved.')) onSaved();
  };

  return (
    <form className="card" onSubmit={(event) => void submit(event)}>
      <h2>Company</h2>
      <div className="form-grid">
        <Field label="Company name" error={errors.name}>
          <input required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Website" error={errors.website} hint="Include https://">
          <input value={form.website} onChange={set('website')} />
        </Field>
        <Field label="Industry" error={errors.industry}>
          <input value={form.industry} onChange={set('industry')} />
        </Field>
        <Field label="Company size" error={errors.size}>
          <select value={form.size} onChange={set('size')}>
            <option value="">Select size</option>
            {['1-10', '11-50', '51-200', '201-500', '501+'].map((size) => (
              <option key={size} value={size}>
                {size} employees
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location" error={errors.location}>
          <input value={form.location} onChange={set('location')} />
        </Field>
      </div>
      <Field label="About the company" error={errors.description}>
        <textarea rows={5} maxLength={5000} value={form.description} onChange={set('description')} />
      </Field>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save company'}
        </button>
      </div>
    </form>
  );
}

function ContactForm({ profile, onSaved }: { profile: EmployerProfile; onSaved: () => void }) {
  const { busy, errors, run } = useAction();
  const [form, setForm] = useState({
    name: profile.name,
    phone: profile.phone ?? '',
    position: profile.position ?? '',
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(() => employerApi.updateProfile(form), 'Contact details saved.')) onSaved();
  };

  return (
    <form className="card" onSubmit={(event) => void submit(event)}>
      <h2>Your contact details</h2>
      <div className="form-grid">
        <Field label="Full name" error={errors.name}>
          <input required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Position" error={errors.position}>
          <input value={form.position} onChange={set('position')} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input value={form.phone} onChange={set('phone')} />
        </Field>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-secondary" disabled={busy}>
          Save contact details
        </button>
      </div>
    </form>
  );
}

export function CompanyPage() {
  const state = useAsync(useCallback(() => employerApi.profile(), []));
  const reload = () => void state.reload();

  return (
    <>
      <PageHeader title="Company Profile" subtitle="Shown to candidates on each of your job postings." />
      <AsyncView state={state}>
        {(profile) => (
          <div className="stack">
            <CompanyForm profile={profile} onSaved={reload} />
            <ContactForm profile={profile} onSaved={reload} />
          </div>
        )}
      </AsyncView>
    </>
  );
}
