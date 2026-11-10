import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applicationResumeUrl, jobsApi } from '../../api';
import {
  ApplicationBadge,
  AsyncView,
  EmptyState,
  PageHeader,
  Pagination,
  SkillTags,
} from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES, formatDate } from '../../lib/format';

export function ApplicantsPage() {
  const { id = '' } = useParams();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const state = useAsync(
    useCallback(() => jobsApi.applicants(id, { status, page, limit: 10 }), [id, status, page]),
  );

  return (
    <>
      <Link to="/employer/jobs" className="back-link">
        ← Manage Jobs
      </Link>
      <AsyncView state={state}>
        {(result) => (
          <>
            <PageHeader title="Applicants" subtitle={result.job.title} />
            <div className="toolbar">
              <label className="sort">
                <span>Status</span>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {APPLICATION_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {APPLICATION_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {result.items.length === 0 ? (
              <EmptyState title="No applicants to show" />
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Candidate</th>
                        <th>Skills</th>
                        <th>Experience</th>
                        <th>Applied</th>
                        <th>Status</th>
                        <th>Resume</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((applicant) => (
                        <tr key={applicant.id}>
                          <td>
                            <strong>{applicant.candidate.name}</strong>
                            {applicant.candidate.headline && (
                              <div className="cell-sub">{applicant.candidate.headline}</div>
                            )}
                          </td>
                          <td>
                            <SkillTags skills={applicant.candidate.skills.slice(0, 4)} />
                          </td>
                          <td>
                            {applicant.candidate.experienceYears} yrs
                            {applicant.candidate.latestRole && (
                              <div className="cell-sub">{applicant.candidate.latestRole}</div>
                            )}
                          </td>
                          <td>{formatDate(applicant.createdAt)}</td>
                          <td>
                            <ApplicationBadge status={applicant.status} />
                          </td>
                          <td>
                            {applicant.hasResume ? (
                              <a href={applicationResumeUrl(applicant.id)}>Download</a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <Link to={`/employer/applicants/${applicant.id}`}>View Candidate</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination meta={result.meta} onChange={setPage} />
              </>
            )}
          </>
        )}
      </AsyncView>
    </>
  );
}
