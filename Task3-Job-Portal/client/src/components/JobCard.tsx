import { Link } from 'react-router-dom';
import {
  EXPERIENCE_LABELS,
  formatDate,
  formatSalary,
  JOB_TYPE_LABELS,
  WORK_MODE_LABELS,
} from '../lib/format';
import type { Job } from '../types';
import { SkillTags } from './ui';

export function JobCard({ job }: { job: Job }) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div className="company-mark" aria-hidden="true">
          {job.company.name.charAt(0)}
        </div>
        <div>
          <h3>
            <Link to={`/jobs/${job.id}`}>{job.title}</Link>
          </h3>
          <p className="job-company">
            {job.company.name} · {job.location}
          </p>
        </div>
      </div>
      <div className="job-meta">
        <span>{JOB_TYPE_LABELS[job.jobType]}</span>
        <span>{WORK_MODE_LABELS[job.workMode]}</span>
        <span>{EXPERIENCE_LABELS[job.experienceLevel]}</span>
      </div>
      <SkillTags skills={job.skills.slice(0, 5)} />
      <div className="job-card-bottom">
        <strong>{formatSalary(job.salaryMin, job.salaryMax)}</strong>
        <span>Posted {formatDate(job.publishedAt)}</span>
      </div>
    </article>
  );
}
