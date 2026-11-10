import { useCallback, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { jobsApi } from '../../api';
import { SkillEditor } from '../../components/SkillEditor';
import { AsyncView, Field, PageHeader } from '../../components/ui';
import { useAction } from '../../hooks/useAction';
import { useAsync } from '../../hooks/useAsync';
import {
  deadlineToDateInput,
  deadlineToIso,
  EXPERIENCE_LABELS,
  JOB_TYPE_LABELS,
  options,
  WORK_MODE_LABELS,
} from '../../lib/format';
import type { ExperienceLevel, JobDetails, JobInput, JobType, WorkMode } from '../../types';

const toSalary = (value: string) => (value.trim() === '' ? null : Number(value));

function JobForm({ job }: { job?: JobDetails }) {
  const navigate = useNavigate();
  const { busy, errors, run } = useAction();
  const [form, setForm] = useState({
    title: job?.title ?? '',
    description: job?.description ?? '',
    requirements: job?.requirements ?? '',
    responsibilities: job?.responsibilities ?? '',
    location: job?.location ?? '',
    jobType: (job?.jobType ?? 'FULL_TIME') as JobType,
    workMode: (job?.workMode ?? 'ONSITE') as WorkMode,
    experienceLevel: (job?.experienceLevel ?? 'MID') as ExperienceLevel,
    salaryMin: job?.salaryMin?.toString() ?? '',
    salaryMax: job?.salaryMax?.toString() ?? '',
    deadline: deadlineToDateInput(job?.expiresAt ?? null),
  });
  const [skills, setSkills] = useState<string[]>(job?.skills ?? []);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const buildInput = (): JobInput => {
    const { deadline, salaryMin, salaryMax, ...fields } = form;
    const unchanged = job && deadline === deadlineToDateInput(job.expiresAt);
    return {
      ...fields,
      skills,
      salaryMin: toSalary(salaryMin),
      salaryMax: toSalary(salaryMax),
      expiresAt: unchanged ? job.expiresAt : deadlineToIso(deadline),
    };
  };

  const save = async (status?: 'DRAFT' | 'ACTIVE') => {
    const input = buildInput();
    const ok = await run(
      () => (job ? jobsApi.update(job.id, input) : jobsApi.create({ ...input, status })),
      job ? 'Job updated.' : status === 'ACTIVE' ? 'Job published.' : 'Draft saved.',
    );
    if (ok) navigate('/employer/jobs');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(job ? undefined : 'ACTIVE');
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Job title" error={errors.title}>
          <input required value={form.title} onChange={set('title')} />
        </Field>
        <Field label="Location" error={errors.location}>
          <input required value={form.location} onChange={set('location')} />
        </Field>
        <Field label="Job type" error={errors.jobType}>
          <select value={form.jobType} onChange={set('jobType')}>
            {options(JOB_TYPE_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Work mode" error={errors.workMode}>
          <select value={form.workMode} onChange={set('workMode')}>
            {options(WORK_MODE_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Experience level" error={errors.experienceLevel}>
          <select value={form.experienceLevel} onChange={set('experienceLevel')}>
            {options(EXPERIENCE_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Application deadline" error={errors.expiresAt} hint="Optional">
          <input type="date" value={form.deadline} onChange={set('deadline')} />
        </Field>
        <Field label="Minimum salary (INR per year)" error={errors.salaryMin}>
          <input type="number" min={0} step={1} value={form.salaryMin} onChange={set('salaryMin')} />
        </Field>
        <Field label="Maximum salary (INR per year)" error={errors.salaryMax}>
          <input type="number" min={0} step={1} value={form.salaryMax} onChange={set('salaryMax')} />
        </Field>
      </div>
      <Field label="Required skills" error={errors.skills} group>
        <SkillEditor skills={skills} onChange={setSkills} />
      </Field>
      <Field label="Description" error={errors.description}>
        <textarea required rows={6} value={form.description} onChange={set('description')} />
      </Field>
      <Field label="Requirements" error={errors.requirements}>
        <textarea required rows={5} value={form.requirements} onChange={set('requirements')} />
      </Field>
      <Field label="Responsibilities" error={errors.responsibilities}>
        <textarea required rows={5} value={form.responsibilities} onChange={set('responsibilities')} />
      </Field>
      <div className="form-actions">
        <Link to="/employer/jobs" className="btn btn-secondary">
          Cancel
        </Link>
        {!job && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void save('DRAFT')}>
            Save as draft
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {job ? 'Save changes' : 'Publish job'}
        </button>
      </div>
    </form>
  );
}

function EditJob({ id }: { id: string }) {
  const state = useAsync(useCallback(() => jobsApi.details(id), [id]));
  return <AsyncView state={state}>{(job) => <JobForm job={job} />}</AsyncView>;
}

export function JobFormPage() {
  const { id } = useParams();
  return (
    <>
      <PageHeader title={id ? 'Edit Job' : 'Post New Job'} />
      {id ? <EditJob id={id} /> : <JobForm />}
    </>
  );
}
