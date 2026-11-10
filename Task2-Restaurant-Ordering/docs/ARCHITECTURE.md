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
                                                         │ Mongoose ODM
                                                         │ Validated documents
                                                         ▼
                                      ┌────────────────────────────────────────┐
                                      │            MongoDB Database            │
                                      │          (MongoDB, Port 27017)         │
                                      │     "codsoft_restaurant_ordering"      │
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

### 2.3 Database Tier (MongoDB + Mongoose)
- **Engine:** MongoDB (verified on 7.0).
- **ODM:** Mongoose schemas with validation, timestamps, enums, ObjectId references, virtual populate and indexes. See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).
- **Connection:** `server/src/db.ts` connects, then waits until all indexes exist before the server accepts requests.
- **Reliability:** A partial unique index prevents double booking of an exact table slot on any deployment. Related writes run in a transaction on a replica set, and use compensating clean-up on a standalone server.

---

## 3. Core Modules & Workflows

### Module A: Customer-Facing Website & Ordering
- **Menu Exploration:** Category tabs, search filtering, pure veg/non-veg dietary indicators, and dish quick-view modals.
- **Server-Side Price Integrity:** Grand totals and line items are never trusted from the client; the Express backend reads current menu item prices from MongoDB and recalculates subtotals, 5% GST, and delivery fees.
- **Dining Modes:** Dine-In with table allocation, Takeaway / Counter Pickup, and Doorstep Delivery.

### Module B: Table Reservations
- Availability endpoint lists tables without an active booking at the exact date and time.
- Auto-allocation tries each suitable table in turn, so requests that lose a race move to the next table.
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

---

## 4. Key Flows

**Authentication:** login verifies the bcrypt hash and sets a JWT in an HttpOnly cookie. Each request is verified by the `authenticate` or `optionalAuth` middleware. The JWT is never returned in JSON or stored in browser storage.

**Authorization:** `authorize` checks the role on the server. Orders, payments and reservations also check ownership against the identity in the JWT, never against query parameters.

**Cart:** held in React state and browser storage. It has no server collection, and prices shown there are estimates until checkout.

**Checkout and order creation:** the client sends only dish ids, quantities and order details. The server loads current prices and availability from MongoDB, calculates subtotal, 5% GST, delivery fee and total, then saves the order, payment and first status history entries as one unit.

**Payment simulation:** no gateway is connected and no card data is collected. Online methods succeed immediately, or record a failure when a decline is requested, and failed payments can be retried. Cash stays pending until the kitchen completes the order.

**Kitchen Display:** the board polls every 4 seconds. Each change moves through `PENDING → CONFIRMED → PREPARING → READY → COMPLETED`, with `CANCELLED` allowed before completion. The update is conditional on the status that was read, so simultaneous changes cannot both succeed, and each change writes a history entry.

**Reservations:** availability excludes tables already held at the exact date and time. The unique index makes the final decision. There is no duration or overlap rule.

**Admin:** the dashboard aggregates live data. Administrators manage dishes, tables, reservations and user roles, and cannot change their own role.
