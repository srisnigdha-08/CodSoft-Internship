import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { seekerApi } from '../../api';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { SkillEditor } from '../../components/SkillEditor';
import { AsyncView, EmptyState, Field, PageHeader } from '../../components/ui';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import { formatMonthYear, toDateInput } from '../../lib/format';
import type { Education, Experience, SeekerProfile } from '../../types';

function PersonalForm({ profile, onSaved }: { profile: SeekerProfile; onSaved: () => void }) {
  const { busy, errors, run } = useAction();
  const [form, setForm] = useState({
    name: profile.name,
    phone: profile.phone ?? '',
    location: profile.location ?? '',
    headline: profile.headline ?? '',
    summary: profile.summary ?? '',
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(() => seekerApi.updateProfile(form), 'Profile saved.')) onSaved();
  };

  return (
    <form className="card" onSubmit={(event) => void submit(event)}>
      <h2>Personal details</h2>
      <div className="form-grid">
        <Field label="Full name" error={errors.name}>
          <input required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email" hint="Your sign-in email cannot be changed here.">
          <input value={profile.email} disabled />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Location" error={errors.location}>
          <input value={form.location} onChange={set('location')} />
        </Field>
      </div>
      <Field label="Headline" error={errors.headline}>
        <input maxLength={160} value={form.headline} onChange={set('headline')} />
      </Field>
      <Field label="Professional summary" error={errors.summary}>
        <textarea rows={5} maxLength={5000} value={form.summary} onChange={set('summary')} />
      </Field>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  );
}

function SkillsCard({ profile, onSaved }: { profile: SeekerProfile; onSaved: () => void }) {
  const { busy, errors, run } = useAction();
  const [skills, setSkills] = useState(profile.skills);

  useEffect(() => setSkills(profile.skills), [profile.skills]);

  const save = async () => {
    if (await run(() => seekerApi.setSkills(skills), 'Skills saved.')) onSaved();
  };

  return (
    <section className="card">
      <h2>Skills</h2>
      <Field label="Your skills" error={errors.skills} group>
        <SkillEditor skills={skills} onChange={setSkills} />
      </Field>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save skills'}
        </button>
      </div>
    </section>
  );
}

function EducationDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: Education | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { busy, errors, run } = useAction();
  const [form, setForm] = useState({
    institution: entry?.institution ?? '',
    degree: entry?.degree ?? '',
    fieldOfStudy: entry?.fieldOfStudy ?? '',
    startDate: toDateInput(entry?.startDate),
    endDate: toDateInput(entry?.endDate),
    grade: entry?.grade ?? '',
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...form, endDate: form.endDate || null, grade: form.grade || null };
    const saved = await run(
      () =>
        entry
          ? seekerApi.updateEducation(entry.id, payload)
          : seekerApi.addEducation(payload),
      'Education saved.',
    );
    if (saved) onSaved();
  };

  return (
    <Modal title={entry ? 'Edit education' : 'Add education'} onClose={onClose}>
      <form onSubmit={(event) => void submit(event)}>
        <div className="modal-body">
          <Field label="Institution" error={errors.institution}>
            <input required value={form.institution} onChange={set('institution')} />
          </Field>
          <div className="form-grid">
            <Field label="Degree" error={errors.degree}>
              <input required value={form.degree} onChange={set('degree')} />
            </Field>
            <Field label="Field of study" error={errors.fieldOfStudy}>
              <input required value={form.fieldOfStudy} onChange={set('fieldOfStudy')} />
            </Field>
            <Field label="Start date" error={errors.startDate}>
              <input type="date" required value={form.startDate} onChange={set('startDate')} />
            </Field>
            <Field label="End date" error={errors.endDate}>
              <input type="date" value={form.endDate} onChange={set('endDate')} />
            </Field>
            <Field label="Grade" error={errors.grade}>
              <input value={form.grade} onChange={set('grade')} />
            </Field>
          </div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Save
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function ExperienceDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: Experience | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { busy, errors, run } = useAction();
  const [form, setForm] = useState({
    company: entry?.company ?? '',
    jobTitle: entry?.jobTitle ?? '',
    description: entry?.description ?? '',
    startDate: toDateInput(entry?.startDate),
    endDate: toDateInput(entry?.endDate),
  });
  const [current, setCurrent] = useState(entry?.currentlyWorking ?? false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      description: form.description || null,
      endDate: current ? null : form.endDate || null,
      currentlyWorking: current,
    };
    const saved = await run(
      () =>
        entry
          ? seekerApi.updateExperience(entry.id, payload)
          : seekerApi.addExperience(payload),
      'Experience saved.',
    );
    if (saved) onSaved();
  };

  return (
    <Modal title={entry ? 'Edit experience' : 'Add experience'} onClose={onClose}>
      <form onSubmit={(event) => void submit(event)}>
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Company" error={errors.company}>
              <input required value={form.company} onChange={set('company')} />
            </Field>
            <Field label="Job title" error={errors.jobTitle}>
              <input required value={form.jobTitle} onChange={set('jobTitle')} />
            </Field>
            <Field label="Start date" error={errors.startDate}>
              <input type="date" required value={form.startDate} onChange={set('startDate')} />
            </Field>
            <Field label="End date" error={errors.endDate}>
              <input
                type="date"
                disabled={current}
                value={current ? '' : form.endDate}
                onChange={set('endDate')}
              />
            </Field>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={current}
              onChange={(event) => setCurrent(event.target.checked)}
            />
            I currently work here
          </label>
          <Field label="Description" error={errors.description}>
            <textarea rows={4} value={form.description} onChange={set('description')} />
          </Field>
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Save
          </button>
        </footer>
      </form>
    </Modal>
  );
}

type Editing<T> = { entry: T | null } | null;

function EducationCard({ profile, onSaved }: { profile: SeekerProfile; onSaved: () => void }) {
  const [editing, setEditing] = useState<Editing<Education>>(null);
  const [removing, setRemoving] = useState<Education | null>(null);
  const { run } = useAction();

  return (
    <section className="card">
      <div className="section-head">
        <h2>Education</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ entry: null })}>
          Add education
        </button>
      </div>
      {profile.education.length === 0 ? (
        <EmptyState title="No education added" />
      ) : (
        <ul className="entry-list">
          {profile.education.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>
                  {entry.degree}, {entry.fieldOfStudy}
                </strong>
                <span>{entry.institution}</span>
                <span>
                  {formatMonthYear(entry.startDate)} – {formatMonthYear(entry.endDate)}
                  {entry.grade ? ` · ${entry.grade}` : ''}
                </span>
              </div>
              <div className="row-actions">
                <button type="button" className="link-btn" onClick={() => setEditing({ entry })}>
                  Edit
                </button>
                <button type="button" className="link-btn danger" onClick={() => setRemoving(entry)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <EducationDialog
          entry={editing.entry}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onSaved();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Remove education"
          message={`Remove ${removing.degree} from your profile?`}
          confirmLabel="Remove"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            if (await run(() => seekerApi.deleteEducation(removing.id), 'Education removed.')) {
              onSaved();
            }
          }}
        />
      )}
    </section>
  );
}

function ExperienceCard({ profile, onSaved }: { profile: SeekerProfile; onSaved: () => void }) {
  const [editing, setEditing] = useState<Editing<Experience>>(null);
  const [removing, setRemoving] = useState<Experience | null>(null);
  const { run } = useAction();

  return (
    <section className="card">
      <div className="section-head">
        <h2>Experience</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ entry: null })}>
          Add experience
        </button>
      </div>
      {profile.experience.length === 0 ? (
        <EmptyState title="No experience added" />
      ) : (
        <ul className="entry-list">
          {profile.experience.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{entry.jobTitle}</strong>
                <span>{entry.company}</span>
                <span>
                  {formatMonthYear(entry.startDate)} –{' '}
                  {entry.currentlyWorking ? 'Present' : formatMonthYear(entry.endDate)}
                </span>
                {entry.description && <p className="preserve-lines">{entry.description}</p>}
              </div>
              <div className="row-actions">
                <button type="button" className="link-btn" onClick={() => setEditing({ entry })}>
                  Edit
                </button>
                <button type="button" className="link-btn danger" onClick={() => setRemoving(entry)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ExperienceDialog
          entry={editing.entry}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onSaved();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Remove experience"
          message={`Remove ${removing.jobTitle} at ${removing.company} from your profile?`}
          confirmLabel="Remove"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            if (await run(() => seekerApi.deleteExperience(removing.id), 'Experience removed.')) {
              onSaved();
            }
          }}
        />
      )}
    </section>
  );
}

export function ProfilePage() {
  const state = useAsync(useCallback(() => seekerApi.profile(), []));
  const reload = () => void state.reload();

  return (
    <>
      <PageHeader title="Your profile" subtitle="Employers see this when you apply to their jobs." />
      <AsyncView state={state}>
        {(profile) => (
          <div className="stack">
            <PersonalForm profile={profile} onSaved={reload} />
            <SkillsCard profile={profile} onSaved={reload} />
            <EducationCard profile={profile} onSaved={reload} />
            <ExperienceCard profile={profile} onSaved={reload} />
          </div>
        )}
      </AsyncView>
    </>
  );
}
