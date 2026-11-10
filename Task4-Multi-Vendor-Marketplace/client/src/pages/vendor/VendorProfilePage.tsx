import { useState, type FormEvent } from 'react';
import { errorText } from '../../api/client';
import { AddressFields, cleanAddress } from '../../components/AddressFields';
import { ErrorBanner, ResourceView } from '../../components/Feedback';
import { Field, PageHeader, StatusBadge } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { useToast } from '../../hooks/useToast';
import { vendorService } from '../../services';
import type { VendorProfile } from '../../types';

function ProfileForm({ profile }: { profile: VendorProfile }) {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState(profile.businessName);
  const [description, setDescription] = useState(profile.description ?? '');
  const [logo, setLogo] = useState(profile.logo ?? '');
  const [contactEmail, setContactEmail] = useState(profile.contactEmail);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [address, setAddress] = useState(profile.address);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await vendorService.updateProfile({
        businessName,
        description,
        contactEmail,
        address: cleanAddress(address),
        ...(logo ? { logo } : {}),
        ...(phone ? { phone } : {}),
      });
      await refresh();
      toast('Store profile updated');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <form className="card stack narrow" onSubmit={(e) => void submit(e)}>
      <ErrorBanner message={error} />
      {profile.approvalNote && <p className="muted small">Note from the marketplace team: {profile.approvalNote}</p>}
      <Field label="Business name">
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required minLength={2} />
      </Field>
      <Field label="Description">
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Logo URL">
        <input value={logo} onChange={(e) => setLogo(e.target.value)} />
      </Field>
      <div className="form-row">
        <Field label="Contact email">
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <AddressFields value={address} onChange={setAddress} />
      <button type="submit" className="btn btn-primary">
        Save changes
      </button>
    </form>
  );
}

export function VendorProfilePage() {
  const profile = useResource('vendor-profile', vendorService.profile);
  return (
    <>
      <PageHeader title="Store profile" action={profile.data && <StatusBadge status={profile.data.approvalStatus} />} />
      <ResourceView resource={profile}>{(data) => <ProfileForm profile={data} />}</ResourceView>
    </>
  );
}
