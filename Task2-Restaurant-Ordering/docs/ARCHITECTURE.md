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
                                      │        (PostgreSQL 16, Port 5432)      │
                                      │            "dinedesk_db"               │
                                      └────────────────────────────────────────┘
```

### 2.1 Frontend Tier (`/client`)
- **Framework:** React 18 with TypeScript and Vite.
- **Styling:** Tailwind CSS with a warm culinary color palette (cream `#FAF7F2`, charcoal `#1C1917`, terracotta `#C2410C`, amber `#D97706`).
- **State Management:**
  - `AuthContext`: Manages session JWT, user profiles, and one-click role demo switcher (`CUSTOMER`, `KITCHEN_STAFF`, `ADMIN`).
  - `CartContext`: Manages selected menu items, notes, order type selection (`DINE_IN`, `PICKUP`, `DELIVERY`), and local storage persistence.
- **Component Design:** Responsive, accessible, keyboard navigable, and fully reactive with automatic background polling for live order and kitchen status synchronization.

### 2.2 Backend Tier (`/server`)
- **Runtime:** Node.js 22 LTS with TypeScript.
- **Framework:** Express 4 with centralized routing, JSON parsing, cookie handling, and CORS.
- **Validation:** Zod schema validation on every input payload before reaching database or business logic.
- **Security:**
  - Password hashing via `bcryptjs` (salt rounds: 10).
  - Signed JWT tokens delivered via HttpOnly cookies and Bearer headers.
  - Role-based authorization middleware (`requireRole('ADMIN')`, `requireRole(['ADMIN', 'KITCHEN_STAFF'])`).
  - Strict customer ownership checks on orders and reservations.
- **Centralized Error Handling:** Standardized error response format returning appropriate HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500).

### 2.3 Database Tier (PostgreSQL + Prisma ORM)
- **Engine:** PostgreSQL 16.4.
- **ORM:** Prisma Client with relational integrity, foreign key cascading, unique constraints, and ACID transactions.
- **Reliability:** Concurrency-safe table reservation allocations and atomic multi-table order creations (`Order`, `OrderItem`, `Payment`, `OrderStatusHistory`).

---

## 3. Core Modules & Workflows

### Module A: Customer-Facing Website & Ordering
- **Menu Exploration:** Category tabs, search filtering, pure veg/non-veg dietary indicators, and dish quick-view modals.
- **Server-Side Price Integrity:** Grand totals and line items are never trusted from the client; the Express backend queries PostgreSQL menu item prices directly and recalculates subtotals, 5% GST, and delivery fees.
- **Dining Modes:** Dine-In with table allocation, Takeaway / Counter Pickup, and Doorstep Delivery.

### Module B: Real-Time Table Reservations
- Concurrency-controlled reservation system.
- Real-time table availability endpoint checks active reservations for conflicts before booking.
- Database transactions enforce prevention of double-booking on overlapping slots.

### Module C: Kitchen Display System (KDS)
- Kanban workflow columns: Incoming Queue -> In Preparation -> Ready for Service.
- Validated state transition machine: `PENDING` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `COMPLETED`.
- Prevents illegal status transitions (e.g., reverting completed or ready dishes back to cooking).
- 4-second live polling loop for incoming kitchen tickets.

### Module D: Admin Control Center
- Real-time operational metrics: total revenue, active orders, today's reservations, customer count, and top selling dishes.
- Full catalog governance: create, edit, deactivate, or update pricing and images.
- Master orders and reservations ledgers with manual status override capability.
- Staff role management (promote customers to kitchen staff or administrator).

### Module E: Verified Payment Abstraction
- Clearly documented development mock payment adapter simulating real-world gateway transactions.
- Automatic generation of unique payment identifiers (`PAY-XXXXXX`) and transaction references (`TXN-MOCK-XXXXXX`).
- Failure simulation path for testing 402 declined payment workflows.
