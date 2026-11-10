import type { ChangeEvent } from 'react';
import type { Address } from '../types';
import { Field } from './ui';

export const emptyAddress: Address = { line1: '', line2: '', city: '', state: '', postalCode: '', country: 'India' };

export function AddressFields({ value, onChange }: { value: Address; onChange(next: Address): void }) {
  const set = (key: keyof Address) => (event: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: event.target.value });
  return (
    <>
      <Field label="Address line 1">
        <input value={value.line1} onChange={set('line1')} required minLength={3} />
      </Field>
      <Field label="Address line 2 (optional)">
        <input value={value.line2 ?? ''} onChange={set('line2')} />
      </Field>
      <div className="form-row">
        <Field label="City">
          <input value={value.city} onChange={set('city')} required minLength={2} />
        </Field>
        <Field label="State">
          <input value={value.state} onChange={set('state')} required minLength={2} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Postal code">
          <input value={value.postalCode} onChange={set('postalCode')} required />
        </Field>
        <Field label="Country">
          <input value={value.country} onChange={set('country')} required />
        </Field>
      </div>
    </>
  );
}

/** Drops the optional second line when blank so the API receives valid data. */
export const cleanAddress = (address: Address): Address => {
  const { line2, ...rest } = address;
  return line2?.trim() ? { ...rest, line2 } : rest;
};
