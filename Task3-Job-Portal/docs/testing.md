# Testing

## Backend

```bash
cd server
npm test
```

The suite uses Vitest and Supertest against a real MongoDB replica set, using the database named by `TEST_DATABASE_URL`. It applies the actual schema, indexes and validators first and removes all documents between tests.

Three safeguards keep cleanup away from development data. The suite refuses to start unless the test database name contains `test` and differs from the one in `DATABASE_URL`. Before every cleanup, it also asks the connected server which database is in use and stops if that name does not contain `test`. Never point `TEST_DATABASE_URL` at a database you want to keep.

| File | Covers |
| --- | --- |
| `auth.test.ts` | Register, duplicates, login, invalid login, logout, session cookie flags, deactivated users, password change, rate limiting, health, CORS, malformed input |
| `authorization.test.ts` | Role checks, cross-employer and cross-candidate isolation, identity fields ignored |
| `jobs.test.ts` | Create, update, validation, status moves, deletion, search, filters, sorting, pagination, hidden jobs |
| `applications.test.ts` | Apply, duplicates including concurrent requests, closed and expired jobs, ownership, status moves and history, withdrawal, resume access |
| `admin.test.ts` | Statistics, user management, employers, job moderation |
| `profile-resume.test.ts` | Profile sections, company profile, upload validation, replacement, downloads |
| `database.test.ts` | Test database safeguards, unique indexes, collection validators, Prisma's emulated relation rules |

## Frontend

```bash
cd client
npm test
```

Vitest and Testing Library cover the API client's error handling, route protection, the login and registration forms, the job page's apply states, shared components and formatting helpers. Network calls are stubbed in these tests only; the application itself always uses the real API.

## Static checks and builds

```bash
cd server
npm run typecheck
npm run lint
npm run build
```

```bash
cd client
npm run typecheck
npm run lint
npm run build
```

## Browser verification

The full job seeker, employer and admin flows were exercised in Microsoft Edge against the production build, the real API and a real database, using a throwaway automation script that is not part of this repository. The script was run on MongoDB after the database change. The images in `docs/screenshots/` come from an earlier run of the same flows.
