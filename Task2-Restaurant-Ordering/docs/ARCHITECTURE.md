# DineDesk — System Architecture & Design Document

## 1. Executive Summary

**DineDesk** is a full-stack restaurant ordering and table management platform developed for the **CodSoft Full Stack Web Development Internship (Task 2)**. The platform solves the operational inefficiencies of manual order-taking, table phone bookings, and detached kitchen communication by centralizing customers, kitchen staff, and restaurant administrators into a single, cohesive, database-backed platform.

---

## 2. Architecture Overview

```
                                      ┌────────────────────────────────────────┐
                                      │           Browser Client               │
                                      │  (React 18, Vite, TypeScript, Tailwind)│
                                      └──────────────────┬─────────────────────┘
                                                         │ HTTP / REST / JSON
                                                         │ (Port 3000 / Proxy)
                                                         ▼
                                      ┌────────────────────────────────────────┐
                                      │           Express REST API             │
                                      │   (Node.js 22, TypeScript, Express 4)  │
                                      │              (Port 5050)               │
                                      └──────────────────┬─────────────────────┘
                                                         │ Prisma ORM Client
                                                         │ Parameterized SQL
                                                         ▼
                                      ┌────────────────────────────────────────┐
                                      │         PostgreSQL Database            │
                                      │        (PostgreSQL, Port 5432)      │
                                      │            "dinedesk_db"               │
                                      └────────────────────────────────────────┘
```

### 2.1 Frontend Tier (`/client`)
- **Framework:** React 18 with TypeScript and Vite.
- **Styling:** Tailwind CSS with a warm culinary color palette (cream `#FAF7F2`, charcoal `#1C1917`, terracotta `#C2410C`, amber `#D97706`).
- **State Management:**
  - `AuthContext`: Tracks the signed-in user (the JWT stays in an HttpOnly cookie) and provides a development-only demo sign-in (`CUSTOMER`, `KITCHEN_STAFF`, `ADMIN`).
  - `CartContext`: Manages selected menu items, notes, order type selection (`DINE_IN`, `PICKUP`, `DELIVERY`), and local storage persistence.
- **Navigation:** React state rather than URL routes, so a refresh returns to Home.
- **Component Design:** Responsive layout, with order and kitchen status refreshed by polling every 4 seconds.

### 2.2 Backend Tier (`/server`)
- **Runtime:** Node.js with TypeScript.
- **Framework:** Express 4 with centralized routing, JSON parsing, cookie handling, and CORS.
- **Validation:** Zod validation of request bodies and important query parameters before business logic runs.
- **Security:**
  - Password hashing via `bcryptjs` (salt rounds: 10).
  - JWTs delivered only via an HttpOnly cookie. The API also accepts a Bearer header for API tools.
  - Role-based authorization middleware (`authorize(Role.ADMIN)`, `authorize([Role.KITCHEN_STAFF, Role.ADMIN])`).
  - Strict customer ownership checks on orders and reservations.
- **Centralized Error Handling:** Standardized error response format returning appropriate HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500).

### 2.3 Database Tier (PostgreSQL + Prisma ORM)
- **Engine:** PostgreSQL (verified on 18.6).
- **ORM:** Prisma Client with relational integrity, foreign key cascading, unique constraints, and ACID transactions.
- **Reliability:** A partial unique index and row locks prevent double booking of an exact table slot, with atomic multi-table order creations (`Order`, `OrderItem`, `Payment`, `OrderStatusHistory`).

---

## 3. Core Modules & Workflows

### Module A: Customer-Facing Website & Ordering
- **Menu Exploration:** Category tabs, search filtering, pure veg/non-veg dietary indicators, and dish quick-view modals.
- **Server-Side Price Integrity:** Grand totals and line items are never trusted from the client; the Express backend queries PostgreSQL menu item prices directly and recalculates subtotals, 5% GST, and delivery fees.
- **Dining Modes:** Dine-In with table allocation, Takeaway / Counter Pickup, and Doorstep Delivery.

### Module B: Table Reservations
- Availability endpoint lists tables without an active booking at the exact date and time.
- Booking transactions lock candidate tables with `SELECT ... FOR UPDATE`.
- A partial unique index guarantees one active reservation per table, date and time.
- There is no dining duration, so different start times on one table do not conflict.

### Module C: Kitchen Display System (KDS)
- Kanban workflow columns: Incoming Queue -> In Preparation -> Ready for Service.
- Validated state transition machine: `PENDING` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `COMPLETED`.
- Prevents illegal status transitions (e.g., reverting completed or ready dishes back to cooking).
- The board polls for orders every 4 seconds.

### Module D: Admin Control Center
- Operational metrics: total revenue, active orders, today's reservations, customer count, and top selling dishes.
- Menu items: create, edit, delete, update pricing and images, and toggle availability.
- Orders ledger (read-only). Reservation ledger with confirm, complete and cancel actions.
- Tables: create and activate/deactivate.
- Staff role management (promote customers to kitchen staff or administrator).

### Module E: Simulated Payments
- Payments are simulated in the controllers. No gateway is connected.
- Automatic generation of unique payment identifiers (`PAY-XXXXXX`) and transaction references (`TXN-MOCK-XXXXXX`).
- Failure simulation path for testing 402 declined payment workflows.
