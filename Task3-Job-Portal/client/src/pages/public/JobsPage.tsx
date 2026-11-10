import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jobsApi } from '../../api';
import { JobCard } from '../../components/JobCard';
import { AsyncView, EmptyState, Pagination } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { EXPERIENCE_LABELS, JOB_TYPE_LABELS, options, WORK_MODE_LABELS } from '../../lib/format';

const PAGE_SIZE = 8;

const FILTERS = [
  { key: 'jobType', label: 'Job type', choices: options(JOB_TYPE_LABELS) },
  { key: 'workMode', label: 'Work mode', choices: options(WORK_MODE_LABELS) },
  { key: 'experienceLevel', label: 'Experience', choices: options(EXPERIENCE_LABELS) },
] as const;

export function JobsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [q, setQ] = useState(params.get('q') ?? '');

  useEffect(() => {
    setQ(new URLSearchParams(query).get('q') ?? '');
  }, [query]);

  const results = useAsync(
    useCallback(() => {
      const current = new URLSearchParams(query);
      return jobsApi.search({
        q: current.get('q') ?? undefined,
        location: current.get('location') ?? undefined,
        jobType: current.get('jobType') ?? undefined,
        workMode: current.get('workMode') ?? undefined,
        experienceLevel: current.get('experienceLevel') ?? undefined,
        sort: current.get('sort') ?? 'newest',
        page: Number(current.get('page') ?? 1),
        limit: PAGE_SIZE,
      });
    }, [query]),
  );
  const filterOptions = useAsync(useCallback(() => jobsApi.filters(), []));

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any change other than turning the page starts again from the first page.
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    update({ q: q.trim() });
  };

  const hasFilters = ['q', 'location', 'jobType', 'workMode', 'experienceLevel'].some((key) =>
    params.get(key),
  );

  return (
    <main className="container jobs-page">
      <form className="search-bar" onSubmit={submitSearch} role="search">
        <input
          aria-label="Search jobs"
          placeholder="Search by title, company, skill or location"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <div className="jobs-layout">
        <aside className="filters" aria-label="Filters">
          <div className="filters-head">
            <h2>Filters</h2>
            {hasFilters && (
              <button type="button" className="link-btn" onClick={() => setParams({})}>
                Clear all
              </button>
            )}
          </div>
          <label className="filter">
            <span>Location</span>
            <select
              value={params.get('location') ?? ''}
              onChange={(event) => update({ location: event.target.value })}
            >
              <option value="">Any location</option>
              {filterOptions.data?.locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>
          {FILTERS.map((filter) => (
            <label className="filter" key={filter.key}>
              <span>{filter.label}</span>
              <select
                value={params.get(filter.key) ?? ''}
                onChange={(event) => update({ [filter.key]: event.target.value })}
              >
                <option value="">Any</option>
                {filter.choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </aside>

        <section className="jobs-results">
          <AsyncView state={results}>
            {(page) => (
              <>
                <div className="results-head">
                  <p aria-live="polite">
                    <strong>{page.meta.total}</strong> {page.meta.total === 1 ? 'job' : 'jobs'} found
                  </p>
                  <label className="sort">
                    <span>Sort by</span>
                    <select
                      value={params.get('sort') ?? 'newest'}
                      onChange={(event) => update({ sort: event.target.value })}
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                  </label>
                </div>
                {page.items.length === 0 ? (
                  <EmptyState
                    title="No jobs match your search"
                    message="Try a broader term or remove a filter."
                  />
                ) : (
                  <div className="job-grid job-grid-2">
                    {page.items.map((job) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                )}
                <Pagination meta={page.meta} onChange={(p) => update({ page: String(p) })} />
              </>
            )}
          </AsyncView>
        </section>
      </div>
    </main>
  );
}
