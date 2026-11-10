# DineDesk — Restaurant Ordering & Table Management Platform

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A full-stack restaurant ordering and table reservation application built for the **CodSoft Full Stack Web Development Internship (Task 2)**. Customers browse a menu, place dine-in, pickup or delivery orders, and book tables. Kitchen staff work through an order queue, and administrators manage the menu, tables, reservations and user roles.

This is an internship demonstration project. **Payments are simulated:** no payment gateway is connected and no money is charged.

---

## Features

### Customer
- Registration, login, logout, and a session that survives a page reload.
- Menu with category tabs, text search, a vegetarian filter and a dish detail modal.
- Cart with quantity controls (1 to 50 per dish), saved in the browser.
- Checkout for **dine-in** (table selection), **pickup** and **delivery** (address required).
- 5% GST and a flat ₹40 delivery fee. The server recalculates every price and total from the database.
- Simulated online payment, including a "simulate a declined payment" option and a retry, or cash on handover.
- Order history and an order tracker that **refreshes the status every 4 seconds by polling**.
- Order cancellation while the order is `PENDING` or `CONFIRMED`. Simulated payments are marked `REFUNDED`.
- Table reservations with availability lookup, automatic or manual table choice, and cancellation of your own booking.

Guests can order and reserve without an account. Order history, reservation history and booking cancellation require an account.

### Kitchen Display System
- Three-column board (incoming, in preparation, ready), oldest first, refreshed every 4 seconds by polling.
- Server-enforced lifecycle: `PENDING → CONFIRMED → PREPARING → READY → COMPLETED`, with `CANCELLED` allowed before completion.
- Available to `KITCHEN_STAFF` and `ADMIN` only.

### Admin
- Dashboard: revenue from completed orders, active orders, today's reservations, customer count, top dishes.
- Menu items: create, edit, delete, and toggle availability.
- Tables: create and activate/deactivate.
- Reservations: view, confirm, complete, cancel.
- Orders: read-only ledger with a link to each order. Admins advance orders through the Kitchen Display.
- Users: list accounts and change roles, including promotion to kitchen staff. Admins cannot change their own role.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Lucide icons |
| Backend | Node.js, Express 4, TypeScript 5, Zod validation |
| Database | PostgreSQL with Prisma ORM 5.22 and Prisma Migrate |
| Authentication | JWT in an HttpOnly cookie, bcrypt password hashing (`bcryptjs`), role-based authorization |
| Testing | Vitest and Supertest (backend integration tests) |

Verified with Node.js 24 and PostgreSQL 18.

---

## Architecture Overview

```text
Browser (React SPA, :3000) --/api proxy--> Express REST API (:5050) --Prisma--> PostgreSQL
```

- **Frontend:** a single-page app using React state for navigation, so pages have no individual URLs. Refreshing the browser returns to the Home page while the login session and cart are kept.
- **API:** `routes → middleware (authenticate, authorize) → controllers`. Controllers validate input with Zod and use transactions for multi-step writes.
- **Order tracking:** HTTP polling every 4 seconds. The project does not use WebSockets or Server-Sent Events.

```text
Task2-Restaurant-Ordering/
├── client/src/       # components, context (Auth, Cart), pages, services/api.ts, types
├── server/
│   ├── prisma/       # schema.prisma, migrations/, seed.ts
│   ├── src/          # controllers, middleware, routes, utils, app.ts, config.ts, server.ts
│   └── tests/        # api.test.ts, global-setup.ts
├── docs/             # architecture, API, database, testing, demo script, screenshots guide
├── .env.example
└── package.json      # root orchestration scripts
```

Further reading: [Architecture](docs/ARCHITECTURE.md), [API specification](docs/API_SPECIFICATION.md), [Database schema](docs/DATABASE_SCHEMA.md), [Testing report](docs/TESTING_REPORT.md), [Learning guide](docs/LEARNING_GUIDE.md), [Demo video outline](docs/DEMO_VIDEO_OUTLINE.md).

---

## Setup

### Prerequisites
- Node.js 20 or newer, and npm.
- A running PostgreSQL server.

### 1. Install dependencies
```powershell
git clone https://github.com/srisnigdha-08/CodSoft-Internship.git
cd CodSoft-Internship/Task2-Restaurant-Ordering
npm run install:all
```

### 2. Configure the environment
```powershell
Copy-Item server/.env.example server/.env
```
Edit `server/.env` and replace every placeholder. Generate each secret with:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string for the application |
| `JWT_SECRET` | Yes | Signs JWTs. The server refuses to start without it |
| `COOKIE_SECRET` | Yes | Passed to `cookie-parser`. The server refuses to start without it |
| `FRONTEND_ORIGIN` | Yes | The one browser origin allowed by CORS. Use `http://localhost:3000` locally |
| `TEST_DATABASE_URL` | For tests | A separate database whose name contains `test` |
| `JWT_EXPIRES_IN` | No | Token lifetime, default `7d` |
| `PORT` | No | API port, default `5050` |
| `NODE_ENV` | No | `development` or `production` |

`.env` files are git-ignored. Never commit real credentials.

### 3. Create the database and seed demo data
Create an empty database matching `DATABASE_URL`, then run:
```powershell
npm run db:migrate
npm run db:seed
```

`db:migrate` runs `prisma migrate deploy`, which only applies pending migrations. The seed is safe to re-run and refuses to run when `NODE_ENV=production`.

**Upgrading a database created earlier with `prisma db push`:** mark the baseline as already applied, then deploy the rest. Existing rows are kept. The second migration fails if the table already contains duplicate active bookings for the same table and slot, and those must be resolved first.
```powershell
cd server
npx prisma migrate resolve --applied 20261110000000_init
npx prisma migrate deploy
```

### 4. Run the app
In two terminals:
```powershell
npm run dev:server
```
```powershell
npm run dev:client
```
Open **http://localhost:3000**. Use `localhost` rather than `127.0.0.1`, because only the configured `FRONTEND_ORIGIN` is allowed.

### Demo accounts
Created by the seed for local evaluation only:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@dinedesk.local` | `Admin@12345` |
| Kitchen staff | `kitchen@dinedesk.local` | `Kitchen@12345` |
| Customer | `customer@dinedesk.local` | `Customer@12345` |

In development, the header and login page show one-click demo sign-in buttons. They are removed from production builds.

---

## Workflows

**Customer:** open the Digital Menu → add dishes → open the cart and choose dine-in, pickup or delivery → check out with simulated online payment or cash → follow the order tracker → cancel if the kitchen has not started → reserve a table under Reservations.

**Kitchen:** sign in as kitchen staff → open Kitchen → confirm pending (cash or unpaid) orders → start cooking → mark ready → complete and hand over. Completing a cash order marks its payment as collected.

**Admin:** sign in as administrator → open Admin → review metrics → manage dishes, tables, reservations and user roles.

---

## API Overview

Base path: `/api/v1`. Full details are in [docs/API_SPECIFICATION.md](docs/API_SPECIFICATION.md).

| Area | Endpoints | Access |
|---|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Public, except `/me` |
| Menu | `GET /menu`, `GET /menu/:id`, `GET /categories` | Public |
| Menu management | `POST/PATCH/DELETE /menu`, `POST/PATCH/DELETE /categories` | Admin |
| Orders | `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel` | Guest or owner, staff |
| Order history | `GET /orders/my` | Signed in |
| Kitchen | `GET /kitchen/orders`, `PATCH /kitchen/orders/:id/status` | Kitchen, Admin |
| Reservations | `GET /reservations/availability`, `POST /reservations` | Public |
| My reservations | `GET /reservations/my`, `PATCH /reservations/:id/cancel` | Signed in, owner |
| Reservation management | `GET /reservations`, `PATCH /reservations/:id/status` | Kitchen, Admin |
| Tables | `GET /tables`, `POST/PATCH/DELETE /tables` | Public read, Admin write |
| Payments (simulated) | `POST /payments/checkout`, `GET /payments/:id` | Guest or owner, staff |
| Admin | `GET /admin/stats`, `GET /admin/orders`, `GET /admin/users`, `PATCH /admin/users/:id/role` | Admin |

---

## Testing and Building

The backend tests write and delete rows, so they run against a separate database. `npm test` stops with an error unless `TEST_DATABASE_URL` is set, its database name contains `test`, and it differs from `DATABASE_URL`. Before the tests run, migrations and the seed are applied to that test database only.

```powershell
npm run test        # backend integration tests
npm run typecheck   # server and client TypeScript checks
npm run build       # server and client production builds
```

There are no automated frontend tests and no lint configuration. See [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md) for the latest results.

---

## Security Notes

- Passwords are stored as bcrypt hashes.
- The JWT is set in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). It is not returned in JSON or stored in browser storage. The API also accepts an `Authorization: Bearer` header for API tools.
- `JWT_SECRET` and `COOKIE_SECRET` have no fallback. The server refuses to start if either is missing, and rejects short or placeholder values in production.
- Role checks run on the server. Registration always creates a `CUSTOMER`.
- CORS allows only `FRONTEND_ORIGIN`, with credentials. Requests without an `Origin` header (curl, server-to-server) are not blocked by CORS, so they rely on authentication.
- Account orders and reservations are visible only to their owner and staff. A guest order is reachable only through its unguessable UUID, which works like a private link.
- Zod validates request bodies and important query parameters on the server. Prisma parameterizes database queries.

### Reservation double-booking protection
Double booking is prevented at the database level. A partial unique index, `reservations_active_table_slot_key`, allows only one `PENDING` or `CONFIRMED` reservation per table, date and time. Booking transactions also lock the candidate table rows with `SELECT ... FOR UPDATE`, so competing requests are handled one at a time and receive a clean `409 Conflict`.

The guarantee covers the **exact same date and time slot**. See the first limitation below.

---

## Limitations

1. **Reservations have no duration.** A table booked at 19:00 can also be booked at 19:30. The UI offers 30-minute slots and there is no overlap check between them.
2. **Payments are simulated.** No gateway, card data or real refund is involved.
3. **Status updates use 4-second polling**, not push.
4. **A role change takes effect at the next login**, because the role is stored in the JWT (up to `JWT_EXPIRES_IN`). Logout clears the browser cookie but does not revoke a token that was copied elsewhere.
5. **Email addresses are not verified**, and there is no password reset.
6. **No rate limiting or security headers** (such as `helmet`) are configured.
7. **No page URLs:** refresh returns to Home, and pages cannot be bookmarked or shared.
8. **No profile page:** the signed-in name and role appear in the header, and `GET /auth/me` returns the profile.
9. **Category management is API-only**, with no admin screen. A category's `isActive` flag is stored but does not hide its dishes. Deleting a category also deletes its dishes.
10. **Production deployment** needs the frontend and `/api` served from one origin, because the client uses relative API paths and a `SameSite=Lax` cookie.

---

## Screenshots

Captured from the running application with demo data. [docs/screenshots/README.md](docs/screenshots/README.md) lists all ten.

| Menu | Kitchen Display | Admin Dashboard |
|---|---|---|
| ![Customer menu](docs/screenshots/02-customer-menu.png) | ![Kitchen Display System](docs/screenshots/08-kitchen-display.png) | ![Admin dashboard](docs/screenshots/09-admin-dashboard.png) |

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file.
