# REST API

Base path: `/api`. Bodies are JSON unless noted.

## Conventions

```json
{ "success": true, "data": {} }
{ "success": true, "data": [], "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
{ "success": false, "message": "Job not found" }
{ "success": false, "message": "Please correct the highlighted fields",
  "errors": [{ "field": "email", "message": "Enter a valid email address" }] }
```

| Status | Meaning |
| --- | --- |
| 400 | Malformed JSON |
| 401 | Not signed in, invalid session, or wrong credentials |
| 403 | Signed in without permission, or account deactivated |
| 404 | Resource or endpoint not found |
| 409 | Conflict: duplicate, invalid status change, job not accepting applications |
| 413 | File or body too large |
| 422 | Validation failed |
| 429 | Too many authentication attempts |
| 500 | Unexpected error, with a generic message |
| 503 | Health check could not reach the database |

List endpoints accept `page` (default 1) and `limit` (default 10, maximum 50).

## Health

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | `{ "status": "ok", "database": "connected" }` |

## Authentication and account

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public, rate limited | Create a job seeker or employer and sign in |
| POST | `/auth/login` | Public, rate limited | Sign in |
| POST | `/auth/logout` | Public | Clear the session cookie |
| GET | `/auth/me` | Signed in | Current user |
| PATCH | `/users/me` | Signed in | Change display name |
| POST | `/users/me/password` | Signed in, rate limited | Change password |

## Job seekers (`JOB_SEEKER`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET, PUT | `/job-seekers/me` | Read or update the profile |
| GET | `/job-seekers/me/dashboard` | Counts, recent applications, profile checklist |
| PUT | `/job-seekers/me/skills` | Replace the skill list |
| POST | `/job-seekers/me/education` | Add education |
| PUT, DELETE | `/job-seekers/me/education/:id` | Update or remove own entry |
| POST | `/job-seekers/me/experience` | Add experience |
| PUT, DELETE | `/job-seekers/me/experience/:id` | Update or remove own entry |
| GET, DELETE | `/job-seekers/me/resume` | Resume details or removal |
| POST | `/job-seekers/me/resume` | Upload or replace (multipart field `resume`) |
| GET | `/job-seekers/me/resume/file` | Download. `?view=1` opens a PDF in the browser |

## Employers and companies

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET, PUT | `/employers/me` | Employer | Read or update contact details |
| GET | `/employers/me/dashboard` | Employer | Totals and recent applicants |
| GET | `/employers/me/jobs` | Employer | Own jobs. Filters: `status`, `q` |
| GET, PUT | `/companies/me` | Employer | Read, create or update own company |
| GET | `/companies/:id` | Public | Public company details |

## Jobs

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/jobs` | Public | Open jobs. Filters below |
| GET | `/jobs/filters` | Public | Locations with open jobs |
| GET | `/jobs/skills` | Public | Skill suggestions. Optional `q` |
| GET | `/jobs/:id` | Public | Details. Drafts and moderated jobs only for owner or admin |
| POST | `/jobs` | Employer | Create, as `DRAFT` or `ACTIVE` |
| PUT | `/jobs/:id` | Owner or admin | Update |
| PATCH | `/jobs/:id/status` | Owner or admin | Set `ACTIVE`, `DRAFT` or `CLOSED` |
| DELETE | `/jobs/:id` | Owner or admin | Delete, only with no applications |
| GET | `/jobs/:id/applications` | Owner or admin | Applicants. Filter: `status` |

`GET /jobs` filters: `q` (title, company, skill, location), `location`, `skill`, `jobType`, `workMode`, `experienceLevel`, `sort` (`newest` or `oldest`).

Job status moves: `DRAFT` to `ACTIVE` or `CLOSED`; `ACTIVE` to `DRAFT` or `CLOSED`; `CLOSED` to `ACTIVE`; `EXPIRED` to `ACTIVE` or `CLOSED`. Activation requires a future deadline if one is set.

## Applications

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/applications` | Job seeker | Apply: `{ jobId, coverLetter? }` |
| GET | `/applications` | Job seeker | Own applications. Filter: `status` |
| GET | `/applications/:id` | Candidate, job owner, admin | Details and status history |
| POST | `/applications/:id/withdraw` | Owning candidate | Withdraw |
| PATCH | `/applications/:id/status` | Job owner or admin | `{ status }` |
| GET | `/applications/:id/resume` | Candidate, job owner, admin | Submitted resume. `?view=1` for PDF |

Review flow: `APPLIED` to `UNDER_REVIEW` to `SHORTLISTED` to `INTERVIEW` to `HIRED`. `REJECTED` is available from any of the first four stages. Candidates can move to `WITHDRAWN` until a final status is reached. `REJECTED`, `HIRED` and `WITHDRAWN` are final. Employers lose resume access once a candidate withdraws.

## Admin (`ADMIN`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/stats` | Platform totals and applications by status |
| GET | `/admin/users` | Users. Filters: `q`, `role`, `isActive` |
| PATCH | `/admin/users/:id/status` | `{ isActive }`. An admin cannot change their own status |
| GET | `/admin/employers` | Employers with company and job count. Filter: `q` |
| GET | `/admin/jobs` | All jobs. Filters: `q`, `status` |
| PATCH | `/admin/jobs/:id/moderation` | `{ action: "DEACTIVATE", reason }` or `{ action: "RESTORE" }` |
| GET | `/admin/applications` | All applications. Filters: `q`, `status` |
