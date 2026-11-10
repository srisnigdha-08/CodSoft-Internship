import { useCallback, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jobsApi } from '../../api';
import { JobCard } from '../../components/JobCard';
import { AsyncView, EmptyState } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';

export function HomePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const latest = useAsync(
    useCallback(() => jobsApi.search({ limit: 6, sort: 'newest' }), []),
  );

  const search = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (location.trim()) params.set('location', location.trim());
    navigate(`/jobs?${params.toString()}`);
  };

  return (
    <main>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">Open roles, updated by the teams hiring</p>
          <h1>Find work worth showing up for.</h1>
          <p className="hero-lead">
            Search by title, company, skill or city, apply with your resume, and follow every
            application from first review to final decision.
          </p>
          <form className="hero-search" onSubmit={search} role="search">
            <input
              aria-label="Job title, company or skill"
              placeholder="Job title, company or skill"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
            <input
              aria-label="Location"
              placeholder="City or Remote"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <button type="submit" className="btn btn-amber">
              Search jobs
            </button>
          </form>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Latest openings</h2>
          <Link to="/jobs">View all jobs →</Link>
        </div>
        <AsyncView state={latest}>
          {(page) =>
            page.items.length === 0 ? (
              <EmptyState title="No open jobs yet" message="New postings will appear here." />
            ) : (
              <div className="job-grid">
                {page.items.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )
          }
        </AsyncView>
      </section>

      <section className="container section role-panels">
        <div className="role-panel">
          <h2>Looking for a role?</h2>
          <p>Build one profile, keep your resume current and see where each application stands.</p>
          <Link to="/register?role=JOB_SEEKER" className="btn btn-primary">
            Join as a job seeker
          </Link>
        </div>
        <div className="role-panel role-panel-dark">
          <h2>Hiring for your team?</h2>
          <p>Post openings, review candidates and move them through a clear hiring pipeline.</p>
          <Link to="/register?role=EMPLOYER" className="btn btn-amber">
            Join as an employer
          </Link>
        </div>
      </section>
    </main>
  );
}
