# DineDesk — Restaurant Ordering & Table Management Platform

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A complete, production-grade restaurant ordering and table management platform built for the **CodSoft Full Stack Web Development Internship (Task 2)**. The platform connects customers, kitchen staff, and administrators into a synchronized, database-backed platform solving manual order-taking, reservation double-bookings, and disjointed kitchen communication.

---

## Official CodSoft Task 2 Requirements

> **Problem Addressed:** Traditional manual order-taking and paper/phone-based reservation management create operational bottlenecks, miscommunication, and slow table turnarounds.  
> **Solution:** A centralized full-stack restaurant platform providing online orders, digital menus, real-time table reservations, payment workflows, kitchen display operations, and role-based administration.

---

## Core Features & Modules

### 1. Customer-Facing Web Experience
- **Interactive Digital Menu:** Real-time database-backed catalog with category tabs (Starters, Main Course, Desserts, Beverages), instant text search, pure vegetarian filter, and item details.
- **Server-Side Price Recalculation:** Client-submitted subtotals and totals are never trusted; line items, 5% GST, and delivery fees are recalculated directly from PostgreSQL menu prices on the server.
- **Dining Modes:** Dine-In with table selection, Takeaway / Counter Pickup, and Doorstep Delivery with address validation.
- **Live Order Tracker:** Step-by-step progress timeline (`PENDING` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `COMPLETED`) with auto-polling every 4 seconds to reflect live updates from the kitchen.
- **Customer Cancellation:** Orders can be cancelled by the customer if still in `PENDING` or `CONFIRMED` state before active kitchen preparation begins.

### 2. Real-Time Table Reservations
- **Concurrency-Controlled Booking:** Live availability query engine checks table capacities and overlapping time slots.
- **Double-Booking Prevention:** Atomic database transactions prevent conflicting bookings on the same table.
- **Instant Booking Confirmation:** Provides unique reference numbers (`RES-XXXXXX-XXX`) and special request instructions.

### 3. Dedicated Kitchen Display System (KDS)
- **Operational Kanban View:** FIFO incoming queue, active cooking tickets, and ready-for-service pass.
- **Validated State Machine:** Enforces valid transitions (`PENDING` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `COMPLETED`) while rejecting invalid status modifications.
- **Live Auto-Refresh:** Continuous 4-second polling synchronization without requiring manual page reload.

### 4. Admin Management Center
- **Executive Metrics:** Real-time revenue, active orders, today's reservations, customer count, and top selling dishes.
- **Catalog Governance:** Add, edit, change pricing, and toggle dish availability switches in real time.
- **Master Ledgers:** Full orders and table reservations logs with manual status override capability.
- **Staff Role Promotion:** Manage customer accounts and assign `KITCHEN_STAFF` or `ADMIN` roles.

### 5. Verified Payment Abstraction
- Clearly labelled development-only mock payment adapter simulating card, UPI, and cash transactions.
- Provides unique payment reference numbers (`PAY-XXXXXX-XXX`) and transaction IDs (`TXN-MOCK-XXXXXX`).
- Includes a dedicated simulation failure toggle (`simulateFailure: true`) to verify 402 declined payment handling.

---

## Technology Architecture

| Component | Technology Selected |
|---|---|
| **Web Frontend** | React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Lucide Icons |
| **Backend API** | Node.js 22 LTS, Express 4, TypeScript 5, Zod Schema Validation |
| **Database** | PostgreSQL 16.4 |
| **ORM & Migrations**| Prisma Client 5.22, Prisma CLI (`prisma db push`, `prisma generate`) |
| **Authentication** | JSON Web Tokens (JWT), Bcrypt password hashing, HttpOnly cookies |
| **Testing** | Vitest 2.1, Supertest 7.0 |

---

## Project Structure

```text
Task2-Restaurant-Ordering/
├── client/                     # Frontend Application
│   ├── src/
│   │   ├── components/         # Navbar, Footer, MenuCard, QuickViewModal
│   │   ├── context/            # AuthContext, CartContext
│   │   ├── pages/              # Home, Menu, Cart, Checkout, Tracker, Kitchen, Admin
│   │   ├── services/           # api.ts (REST client)
│   │   ├── types/              # TypeScript interface definitions
│   │   ├── App.tsx             # Root router & page coordinator
│   │   ├── main.tsx            # DOM bootstrap
│   │   └── index.css           # Tailwind directives & typography
│   ├── index.html              # HTML shell
│   ├── vite.config.ts          # Vite proxy to backend (:5050)
│   ├── tailwind.config.js      # Custom cream & terracotta theme
│   └── package.json
│
├── server/                     # Backend API & Database
│   ├── prisma/
│   │   ├── schema.prisma       # Relational models & enums
│   │   └── seed.ts             # 14 dishes, 4 categories, 6 tables, 3 test users
│   ├── src/
│   │   ├── controllers/        # auth, menu, orders, kitchen, reservations, payments, admin
│   │   ├── middleware/         # auth, role, error, validation
│   │   ├── routes/             # REST route endpoints
│   │   ├── utils/              # jwt, errors, response helpers
│   │   ├── app.ts              # Express setup with CORS & routes
│   │   ├── config.ts           # Typed environment configuration
│   │   └── server.ts           # Server bootstrap
│   ├── tests/
│   │   └── api.test.ts         # 21 automated integration tests
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── docs/                       # Technical Specifications
│   ├── ARCHITECTURE.md         # Full architecture design
│   ├── API_SPECIFICATION.md    # REST endpoints documentation
│   ├── DATABASE_SCHEMA.md      # Data dictionary & ER diagram
│   └── TESTING_REPORT.md       # 100% test pass verification
│
├── package.json                # Root task orchestration scripts
├── .gitignore                  # Git exclusions
├── .env.example                # Safe environment variable template
└── README.md                   # Comprehensive guide
```

---

## Seed Accounts for Demonstrations

The development database is pre-seeded with accounts for all three user roles:

| Role | Email | Password | Intended Portal |
|---|---|---|---|
| **Administrator** | `admin@dinedesk.local` | `Admin@12345` | `/admin` (Catalog, stats, staff governance) |
| **Kitchen Staff** | `kitchen@dinedesk.local` | `Kitchen@12345` | `/kitchen` (KDS ticket management) |
| **Customer** | `customer@dinedesk.local` | `Customer@12345` | `/menu`, `/orders`, `/reserve` |

> *Tip: The web client top bar includes a **Fast Role Switcher (One-Click Demo)** that signs in instantly without typing credentials.*

---

## Local Setup & Quickstart

### Prerequisites
- Node.js 20+ (Node 22 LTS recommended) and npm.
- PostgreSQL 16 running on `localhost:5432` with an application database (e.g. `dinedesk_db`).

### Step 1: Clone Repository
```powershell
git clone https://github.com/srisnigdha-08/CodSoft-Internship.git
cd CodSoft-Internship/Task2-Restaurant-Ordering
```

### Step 2: Configure Environment
Copy the example environment file:
```powershell
Copy-Item server/.env.example server/.env
```
Edit `server/.env` if your local PostgreSQL credentials differ from the defaults:
```env
PORT=5050
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://postgres@localhost:5432/dinedesk_db?schema=public
JWT_SECRET=dinedesk_jwt_super_secure_secret_key_2026_codsoft_task2
JWT_EXPIRES_IN=7d
COOKIE_SECRET=dinedesk_cookie_secret_key_2026
```

### Step 3: Install Dependencies
```powershell
npm run install:all
```

### Step 4: Synchronize Database & Seed
```powershell
npm run db:push
npm run db:seed
```

### Step 5: Run Automated Tests
```powershell
npm run test
```
All 21 backend integration tests will run against the database and report results.

### Step 6: Start Application
Run the backend and frontend development servers:

**Terminal 1 (Backend API):**
```powershell
npm run dev:server
```
*API Server starts on `http://localhost:5050`*

**Terminal 2 (Frontend Client):**
```powershell
npm run dev:client
```
*Web Application opens on `http://localhost:3000`*

---

## End-to-End Verification Checklist

1. [x] **Database Connectivity:** PostgreSQL 16 connection verified on `localhost:5432`.
2. [x] **Database Schema & Seed:** 14 dishes, 4 categories, 6 tables, 3 users, sample order, and reservation seeded.
3. [x] **Menu Retrieval:** Database-backed dishes display with accurate prices, preparation times, and dietary tags.
4. [x] **Cart & Price Calculation:** Client cart sends items to backend; backend recalculates subtotal, 5% GST, and delivery fee.
5. [x] **Order Creation & Persistence:** Order is saved in PostgreSQL with related line items, payment record, and audit history.
6. [x] **Kitchen Operations:** Orders appear on the Kitchen Display System (`/kitchen`); staff can advance status from `PENDING` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `COMPLETED`.
7. [x] **Live Order Tracking:** Customer order tracker (`/orders/[id]`) polls every 4 seconds and displays the live status change.
8. [x] **Table Reservations:** Concurrency control prevents double-booking and assigns tables in real time.
9. [x] **Payment Adapter:** Mock payment gateway handles instant approval and simulates payment decline when requested.
10. [x] **Admin Governance:** Admin portal allows adding new dishes, toggling availability, managing tables, and reviewing statistics.

---

## Known Limitations & Production Roadmap

1. **Payment Gateway Integration:** The current payment module utilizes a verified development mock payment adapter. For production deployment, replace with live Razorpay or Stripe Webhooks.
2. **Push Notifications:** Order updates currently synchronize via 4-second reactive polling. Future releases will integrate WebSocket or Server-Sent Events (SSE) for sub-second real-time broadcasts.
3. **SMS Alerts:** Contact phone numbers are validated and stored; connecting Twilio or Gupshup would enable automated SMS ticket receipts.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.