# CodSoft Task 1 — Student Management System

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7+-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A full-stack school administration application built with React, TypeScript, Vite, Express, MongoDB, and Mongoose. The project supports administrator, teacher, and student accounts, with database-backed records and role checks on the server.

## Features

- HttpOnly cookie login and logout with bcrypt password hashing.
- Administrator, teacher, and student permissions enforced by the API.
- School dashboard with live student, teacher, attendance trends, grade bands, and fee totals, calculated with MongoDB aggregation.
- Student search, class/status filters, server-side sorting, pagination, profile details, edits, and safe deactivation.
- Teacher profiles, class sections, and teacher assignments.
- Attendance by student, class, and date, with duplicate prevention, role-scoped status correction, visible correction history, and summaries across all matching records.
- Examination schedules and paginated student results with score validation.
- Fee obligations, partial payments, outstanding balances, and payment history; totals include the full ledger.
- An idempotent development seed and a read-only import tool for the original PostgreSQL data.
- React Testing Library tests and Supertest API tests against a real, guarded MongoDB test database.

## Technology

| Part | Technology |
| --- | --- |
| Web client | React 19, TypeScript, Vite 8, CSS |
| API | Node.js 24, Express 5, TypeScript |
| Database | MongoDB with Mongoose |
| Authentication | bcryptjs password hashes, signed JWT in an HttpOnly cookie |
| Tests | Vitest, React Testing Library, Supertest |

## Project structure

```text
Task1-Student-Management/
├── docs/                 # Architecture, schema, API, testing, learning guide, screenshots
├── public/               # Browser icons and static assets
├── server/
│   ├── scripts/          # One-time PostgreSQL-to-MongoDB import
│   ├── src/              # Express app, Mongoose models, and API routes
│   └── tests/            # API and MongoDB behavior tests
└── src/                  # React application, pages, components, and tests
```

## Documentation

| Document | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System layers, request flow, and how atomic writes work without transactions |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Collections, references, embedding choices, indexes, and validation |
| [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md) | Every endpoint, with access rules and response shapes |
| [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md) | What was tested and the recorded results |
| [docs/LEARNING_GUIDE.md](docs/LEARNING_GUIDE.md) | Beginner-friendly walkthrough and viva questions |
| [docs/DEMO_VIDEO_OUTLINE.md](docs/DEMO_VIDEO_OUTLINE.md) | Short recording plan |
| [docs/screenshots/README.md](docs/screenshots/README.md) | Screenshots of the running demo |

## Prerequisites

- Node.js 20.19+ (Node 24 is used during development) and npm.
- MongoDB 7 or later. A local standalone server is enough; a replica set is not required. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and confirm it is running with `Get-Service MongoDB`.
- Windows PowerShell for the commands below.

## Environment variables

The backend reads `server/.env`. Copy the template when the file does not exist:

```powershell
if (-not (Test-Path .\server\.env)) { Copy-Item .\server\.env.example .\server\.env }
notepad server/.env
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Application database. Must name a database: `mongodb://localhost:27017/codsoft_student_management` |
| `MONGODB_TEST_URI` | For tests | Must name exactly `codsoft_student_management_test` |
| `JWT_SECRET` | Yes | Random secret of at least 32 characters; there is no fallback value |
| `PORT` | No | API port, default `5017` |
| `FRONTEND_ORIGIN` | No | Allowed browser origin, default `http://localhost:5173` |
| `NODE_ENV` | No | `production` enables the `Secure` cookie flag and blocks the seed |
| `LEGACY_PG_*` | Only for the import | Read-only access to the old PostgreSQL database |

The API exits with a clear message when a required value is missing. A URI with credentials is never logged. Do not commit `.env`; it is ignored by Git.

## Local setup

Install dependencies and load the demo data from the project root:

```powershell
npm install
npm --prefix .\server install
npm --prefix .\server run db:seed
```

No schema step is needed. MongoDB creates collections on first write, and the API creates the Mongoose indexes when it connects.

The seed is fictional, development-only, and safe to repeat. It refuses to run when `NODE_ENV=production` or against any database not named for this project, never deletes anything, and leaves existing accounts and records as they are. A clean run produces:

| Collection | Documents |
| --- | ---: |
| users | 166 |
| students | 150 |
| teachers | 15 |
| classes | 10 |
| attendance | 4650 (31 school days per student) |
| exams | 30 |
| results | 450 |
| fees | 151 |
| payments | 101 |

Attendance covers the 31 school days ending on the day of the first seed. A later run does not extend it.

Demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@school.local` | `Admin@12345` |
| Teacher | `teacher@school.local` | `Teacher@12345` |
| Student | `student@school.local` | `Student@12345` |

Other generated accounts follow `teacherNNN@staff.example.test` (password `Teacher@12345`) and `studentNNN@students.example.test` (password `Student@12345`). These shared passwords are for local demonstrations only and must never be used with real student information. Generated names and contact details are synthetic.

## Run the application

Use two PowerShell terminals. The backend uses port `5017` by default because this workstation already has another application on port `5000`. In the first terminal, from the project root:

```powershell
npm --prefix .\server run dev
```

In the second, from the project root:

```powershell
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to `http://127.0.0.1:5017`. If you change `PORT` in `server/.env`, start Vite with a matching `$env:VITE_API_PORT='your-port'` value. Verify the database connection with `Invoke-RestMethod http://localhost:5017/api/health`; the endpoint returns HTTP 200 only when MongoDB answers a ping.

## Build

```powershell
# Frontend, from the project root
npm run build

# Backend
npm --prefix .\server run build
npm --prefix .\server start
```

The backend build produces `server/dist`. Serve the frontend `dist` directory with a static web server and configure it to proxy `/api` to the backend. Keep the frontend and API on the same site when using the default `SameSite=Strict` cookie policy.

## Tests and checks

From the project root:

```powershell
# Frontend
npm test
npm run typecheck
npm run lint

# Backend (requires MongoDB)
npm --prefix .\server test
npm --prefix .\server run typecheck
npm --prefix .\server run typecheck:integration
npm --prefix .\server run lint
```

Backend tests run the real Express routes against MongoDB, only in `codsoft_student_management_test`. Before connecting, the suite confirms that `MONGODB_TEST_URI` names exactly that database. It then writes a guard marker, refuses to touch a non-empty unmarked database, and rechecks the marker before each cleanup. The application database is never used. See [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md).

## Migrating existing PostgreSQL data

The application no longer uses PostgreSQL. The import tool exists only to copy data from an older installation, and needs the `psql` client on `PATH` and the `LEGACY_PG_*` values in `server/.env`.

```powershell
# Reads, transforms, and validates. Writes nothing.
npm --prefix .\server run db:migrate:postgres

# Imports, then verifies counts, references, and money totals.
npm --prefix .\server run db:migrate:postgres -- --apply
```

The tool only reads from PostgreSQL, inside a single `READ ONLY` snapshot, and stops if the server does not confirm that mode. It refuses a target that already holds documents from another source. Each legacy row maps to a fixed ObjectId, so running it again changes nothing. The steps are described in [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md#migrating-from-postgresql).

## API overview

All successful responses use a `data` field. Errors use `{ "error": { "code": "...", "message": "..." } }`. Authenticated requests use the `sms_session` HttpOnly cookie set by login. Record IDs are 24-character hexadecimal strings. The full reference is [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md).

| Area | Base path |
| --- | --- |
| Health | `GET /api/health` |
| Authentication | `/api/auth` |
| Dashboard | `/api/dashboard/stats` |
| Students | `/api/students` |
| Teachers | `/api/teachers` |
| Classes | `/api/classes` |
| Attendance and corrections | `/api/attendance` |
| Examinations and results | `/api/academics` |
| Fees and fee payments | `/api/fees` |
| Payment history | `/api/payments` |

## Troubleshooting

- **API exits at startup:** Check that `server/.env` exists and sets `MONGODB_URI` and a `JWT_SECRET` of at least 32 characters.
- **"MongoDB could not be reached":** Run `Get-Service MongoDB` and start the service if needed. Confirm the host and port in `MONGODB_URI`.
- **"must be a mongodb:// URI that names a database":** Add the database name to the end of the URI.
- **Seed refused:** The seed only runs against a database named `codsoft_student_management` or starting with `codsoft_student_management_`, and never with `NODE_ENV=production`.
- **Tests refused:** Set `MONGODB_TEST_URI` to `mongodb://localhost:27017/codsoft_student_management_test`. If that database holds unrelated data, empty it yourself after reviewing it.
- **Signed out after upgrading from PostgreSQL:** Older session cookies carry numeric IDs and are rejected. Sign in again.
- **Port already in use:** Leave the owning application running. Choose a free API port, update `PORT` in `server/.env`, and use the same value for `$env:VITE_API_PORT` before starting Vite.

## Security choices

- Passwords are hashed with bcryptjs. The hash field is excluded from queries by default and never returned by an endpoint.
- Session tokens are signed, stored in an HttpOnly, SameSite=Strict cookie, and expire after eight hours. Nothing is kept in browser storage.
- `JWT_SECRET` has no fallback value.
- Each authenticated request checks that the user and linked student/teacher profile are still active.
- Backend role checks and class assignment checks protect records even if a client changes its UI.
- IDs must be 24-character hex strings and other inputs must have the expected type, so request bodies cannot inject MongoDB query operators. Search text is escaped and matched literally.
- Unique indexes back up API validation, and fee payments use an atomic, guarded update so a fee cannot be overpaid.
- CORS is limited to `FRONTEND_ORIGIN`; unsafe requests with a different `Origin` are rejected.
- The fee workflow records payments only. It does not move money or connect to a payment service.

## Application screenshots

These screenshots show the application with fictional demonstration records:

- [Login](docs/screenshots/login.png)
- [Administrator dashboard](docs/screenshots/dashboard.png)
- [Student directory](docs/screenshots/students.png)
- [Teacher directory](docs/screenshots/teachers.png)
- [Classes](docs/screenshots/classes.png)
- [Attendance](docs/screenshots/attendance.png)
- [Academic results](docs/screenshots/academics.png)
- [Fee management](docs/screenshots/fees.png)

## Known limits

- The seed is for demonstration only and is blocked when `NODE_ENV=production`.
- Another local application owns port 5000, so the API and Vite proxy use port 5017. Do not terminate that unrelated process.
- The frontend has no password reset or password-change screen. Administrators set initial passwords for new accounts.
- Examination and result history is append-only in the UI; correction workflows are not included.
- Attendance corrections capture status, actor ID, and timestamp. The application does not yet require a correction reason or offer an exportable audit report.
- Attendance history shows the latest 200 matching rows; its summary counts all matching rows. Fee history shows the latest 300 records; its totals include all matching records. Larger deployments need pagination or server-side search in both modules.
- Management forms load all pages of the active student roster. A large school would benefit from a searchable student selector.
- Writes that span two documents, such as an account and its profile, undo the first write if the second fails. A process crash between those two steps could leave a partial write; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#atomic-writes-without-transactions).
- Fee records are administrative records only. No payment gateway, invoices, refunds, tax handling, or accounting exports are included.

## GitHub submission preparation

The intended GitHub submission is one multi-task repository named `CODSOFT_TASKSNO`, with this project stored in `Task1-Student-Management/`:

```text
CODSOFT_TASKSNO/
├── Task1-Student-Management/
├── Task2-Restaurant-Ordering/
├── Task3-Job-Portal/
├── Task4-Multi-Vendor-Marketplace/
├── Task5-Logistics-Fleet/
└── README.md
```

Keep the Git root at the parent repository; do not initialize a separate repository inside this task directory. Before creating a commit, review the staged files from the parent root and confirm `.env` files and generated outputs remain excluded. Never force-push or overwrite an existing remote repository. `.env` files, `node_modules`, build output, database dumps, and test coverage are ignored; `.env.example` and `server/.env.example` contain safe placeholders only.
