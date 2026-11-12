# Tidewater Jobs — Job Portal

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

A full-stack job portal built for the **CodSoft Full Stack Web Development Internship (Task 3)**. Job seekers build a profile, upload a resume, search open roles, apply and follow each application. Employers publish jobs and move candidates through a hiring pipeline. Administrators moderate the platform. All data comes from a real Express API and MongoDB database.

This is an internship demonstration project. **All companies, jobs and people in the demo data are fictional**, and no emails are sent.

---

## Features

### Job Seeker
- Registration and sign-in.
- Profile with skills, education and experience.
- Resume upload and replacement, with file checks.
- Job search with filters, sorting and pagination.
- Applying with a cover letter, application tracking with status history, and withdrawal.

### Employer
- Registration and sign-in, and a company profile.
- Job creation and editing, with activation, deactivation, closing and deletion.
- Applicant lists, candidate profiles and resume access.
- Validated application status updates, and dashboard totals.

### Admin
- Platform statistics.
- User activation and deactivation. An admin cannot change their own status.
- Employer overview.
- Job moderation with a recorded reason.
- A view of all applications.

### User roles

| Role | How it is created | Access |
|---|---|---|
| `JOB_SEEKER` | Registration | Own profile, resume and applications |
| `EMPLOYER` | Registration | Own company, jobs and the applications to those jobs |
| `ADMIN` | Seed script only | Platform management |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5, Vite 7, React Router |
| Backend | Node.js, Express 5, TypeScript 5, Zod validation, Multer file uploads |
| Database | MongoDB (replica set) with Prisma 6 |
| Authentication | JWT in an HttpOnly cookie, bcrypt password hashing, role-based authorization |
| Testing | Vitest and Supertest (backend), Vitest and Testing Library (frontend) |

Verified with Node.js 24 and MongoDB 7.0.

---

## Architecture Overview

```text
Browser (React SPA, :5173) --/api proxy--> Express REST API (:4000) --Prisma--> MongoDB replica set
```

- **Frontend:** a React Router app. Vite's dev and preview servers forward `/api` to Express, so the browser talks to one origin.
- **API:** `routes → middleware (auth, uploads) → controllers → services`. Authentication, role checks and Zod validation run before services read or write MongoDB through Prisma.
- **Data:** the main collections are `User`, `JobSeekerProfile`, `EmployerProfile`, `Company`, `Skill`, `JobSkill`, `JobSeekerSkill`, `Job`, `Education`, `Experience`, `Resume`, `Application` and `ApplicationStatusHistory`. A unique index lets a candidate apply to a job only once. See [docs/database.md](docs/database.md).

```text
Task3-Job-Portal/
├── client/src/       # api, components, context (auth, toast), hooks, lib, pages, test
├── server/
│   ├── prisma/       # schema, validators, setup, reset, seed
│   ├── src/          # config, controllers, db, middleware, routes, services, utils, validation
│   └── tests/        # backend tests
└── docs/             # architecture, API, database, testing, screenshots
```

Further reading: [Architecture](docs/architecture.md), [API specification](docs/api.md), [Database schema](docs/database.md), [Testing report](docs/testing.md).

---

## Setup

### Prerequisites
- Node.js 20 or newer, and npm.
- MongoDB running as a **replica set**. Prisma uses multi-document transactions, which MongoDB offers only on a replica set. The API refuses to start on a standalone server.

### 1. Install dependencies
```powershell
git clone https://github.com/srisnigdha-08/CodSoft-Internship.git
cd CodSoft-Internship/Task3-Job-Portal
npm --prefix server install
npm --prefix client install
```

### 2. Configure the environment
```powershell
Copy-Item server/.env.example server/.env
```
Edit `server/.env`. Generate a secret with:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | MongoDB connection string, including the database name |
| `JWT_SECRET` | Yes | Random secret of at least 32 characters |
| `CLIENT_ORIGIN` | Yes | Allowed browser origins, comma separated |
| `TEST_DATABASE_URL` | For tests | Separate database whose name contains `test` and differs from `DATABASE_URL` |
| `JWT_EXPIRES_IN_HOURS` | No | Session length, default 24 |
| `PORT` | No | API port, default 4000 |
| `BCRYPT_ROUNDS` | No | Hash cost, default 12 |
| `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` | No | Limit on authentication attempts |
| `TRUST_PROXY_HOPS` | No | Reverse proxies in front of the API, default 0 |
| `UPLOAD_DIR`, `MAX_RESUME_SIZE_MB` | No | Private resume folder and size limit |
| `ALLOW_DEMO_SEED` | No | Must be `true` to seed demo accounts in production |

`client/.env` is optional; `API_PROXY_TARGET` changes where `/api` is forwarded. `.env` files are git-ignored. Never commit real credentials.

### 3. Start a MongoDB replica set
These commands run a dedicated single-node replica set on port 27018 and leave any existing MongoDB service untouched. Create the data folder, then start the server and leave it running:
```powershell
mkdir D:/mongo-data/job-portal
mongod --replSet rs0 --port 27018 --bind_ip 127.0.0.1 --dbpath D:/mongo-data/job-portal
```
In a second terminal, initialise the replica set once. Later starts only need the `mongod` command.
```powershell
mongosh --port 27018 --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27018'}]})"
```
On Windows, `mongod` is usually in `C:\Program Files\MongoDB\Server\<version>\bin`. The connection strings in `.env.example` match these commands. For a hosted or password-protected server, put its connection string only in `server/.env`.

### 4. Create the schema
MongoDB has no SQL migrations. These commands create the collections and indexes and apply the validation rules. Run them after installing and whenever `schema.prisma` changes.
```powershell
cd server
npm run db:generate
npm run db:setup
```

### 5. Seed demo data
```powershell
npm run db:seed
```
The seed can be run repeatedly without creating duplicates.

To start over, `npm run db:reset -- --confirm job_portal` erases the database in `DATABASE_URL`, then recreates and reseeds it. You must repeat the database name to confirm, and it refuses to run with `NODE_ENV=production`. Uploaded resume files are not deleted.

### 6. Run the app
In two terminals:
```powershell
npm --prefix server run dev
```
```powershell
npm --prefix client run dev
```
Open **http://localhost:5173**. The API listens on http://localhost:4000, and `GET /api/health` reports its status.

### Demo accounts
Created by the seed for local evaluation only. The password for every account is `Demo@12345`. Never seed them into a real deployment.

| Role | Email |
|---|---|
| Admin | `admin@jobportal.example` |
| Employer | `hiring@northbeam.example` |
| Employer | `hiring@cedarstudio.example` |
| Employer | `hiring@harborline.example` |
| Job seeker | `aarav.seeker@jobportal.example` |
| Job seeker | `meera.seeker@jobportal.example` |
| Job seeker | `kabir.seeker@jobportal.example` |

---

## Workflows

**Job seeker:** register or sign in → complete the profile with skills, education and experience → upload a resume → search and filter jobs → apply with a cover letter → follow the application's status history → withdraw if needed.

**Employer:** sign in → set up the company profile → create a job as a draft or publish it → review applicants and their resumes → move each application through the hiring stages → close the job.

**Admin:** sign in → review platform statistics → activate or deactivate users → moderate a job with a recorded reason → review all applications.

---

## API Overview

Base path: `/api`. Full details are in [docs/api.md](docs/api.md).

| Area | Endpoints | Access |
|---|---|---|
| Health | `GET /health` | Public |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Public, except `/me`. Register and login are rate limited |
| Account | `PATCH /users/me`, `POST /users/me/password` | Signed in |
| Job seeker profile | `GET/PUT /job-seekers/me`, `GET /job-seekers/me/dashboard`, `PUT /job-seekers/me/skills`, education and experience entries | Job seeker |
| Resume | `GET/POST/DELETE /job-seekers/me/resume`, `GET /job-seekers/me/resume/file` | Job seeker |
| Employer | `GET/PUT /employers/me`, `GET /employers/me/dashboard`, `GET /employers/me/jobs` | Employer |
| Companies | `GET/PUT /companies/me` | Employer |
| Public companies | `GET /companies/:id` | Public |
| Jobs | `GET /jobs`, `GET /jobs/filters`, `GET /jobs/skills`, `GET /jobs/:id` | Public |
| Job management | `POST /jobs`, `PUT /jobs/:id`, `PATCH /jobs/:id/status`, `DELETE /jobs/:id`, `GET /jobs/:id/applications` | Employer for create; owner or admin otherwise |
| Applications | `POST /applications`, `GET /applications`, `POST /applications/:id/withdraw` | Job seeker, own applications |
| Application review | `GET /applications/:id`, `GET /applications/:id/resume` | Candidate, job owner, admin |
| Application status | `PATCH /applications/:id/status` | Job owner or admin |
| Admin | `GET /admin/stats`, `/admin/users`, `/admin/employers`, `/admin/jobs`, `/admin/applications`, `PATCH /admin/users/:id/status`, `PATCH /admin/jobs/:id/moderation` | Admin |

---

## Testing and Building

The backend tests run against the separate database in `TEST_DATABASE_URL`, whose name must contain `test` and differ from `DATABASE_URL`.

```powershell
npm --prefix server test        # backend tests
npm --prefix client test        # frontend tests
npm --prefix server run typecheck
npm --prefix client run typecheck
npm --prefix server run lint
npm --prefix client run lint
```

To build for production:
```powershell
npm --prefix server run build
npm --prefix server start
npm --prefix client run build
npm --prefix client run preview
```

See [docs/testing.md](docs/testing.md) for the latest results.

---

## Security Notes

- Passwords are hashed with bcrypt and never returned by the API.
- The JWT is set in an `HttpOnly`, `SameSite=Strict` cookie (`Secure` in production). It is never returned in a response body or stored in browser storage.
- Each request reloads the user from the database, so deactivating an account takes effect immediately.
- Role and ownership checks run on the server. Client-supplied user identifiers are ignored.
- Zod validates bodies, query strings and parameters. Queries are built through Prisma, never from concatenated user input.
- CORS is limited to `CLIENT_ORIGIN`, and Helmet sets security headers.
- Registration, login and password change are rate limited.
- Resumes are checked for extension, MIME type, file signature, size and filename, then stored under generated names outside any public path. They are served only after an authorization check.
- Central error handling returns safe messages without stack traces or internal details.
- Secrets come from environment variables. Only `.env.example` files are tracked.

### Transactions and integrity
Prisma writes related records in multi-document transactions, which is why a replica set is required. MongoDB has no foreign keys, so relations and cascades are enforced by Prisma Client. Unique indexes and collection validators still apply to every write.

---

## Limitations

1. **Relations are enforced by Prisma Client.** Changes made directly in the database bypass relation and cascade rules. Unique indexes and collection validators still apply.
2. **Resumes are not virus scanned**, and are stored on the API server's local disk.
3. **Rate limits are held in memory** per server process.
4. **One site only.** A deployment must serve the client and API from the same site, because the session cookie is `SameSite=Strict`.
5. **Salaries are shown in Indian rupees per year.**
6. **Each employer account manages one company.**
7. **No email notifications or real-time updates.**
8. **A replica set is required.** The API does not run on a standalone MongoDB server.

---

## Screenshots

Captured from the running application with fictional data.

| Job Search | Job Seeker Dashboard | Employer Dashboard |
|---|---|---|
| ![Job search](docs/screenshots/02-home-jobs.png) | ![Job seeker dashboard](docs/screenshots/04-job-seeker-dashboard.png) | ![Employer dashboard](docs/screenshots/07-employer-dashboard.png) |

Also available: [Sign in](docs/screenshots/01-login.png), [Job details](docs/screenshots/03-job-details.png), [Profile](docs/screenshots/05-profile.png), [Application tracking](docs/screenshots/06-application.png), [Job management](docs/screenshots/08-job-management.png), [Applicants](docs/screenshots/09-applicants.png), [Admin dashboard](docs/screenshots/10-admin-dashboard.png).

---

## License

This project is licensed under the MIT License. See the repository [LICENSE](../LICENSE) file.
