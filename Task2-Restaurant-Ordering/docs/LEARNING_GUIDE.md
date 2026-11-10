# Learning Guide — DineDesk Restaurant Platform

This learning guide provides an in-depth walkthrough of the design, architectural patterns, database modeling, security principles, and engineering decisions implemented in **DineDesk**. It is written for engineering students, junior developers, and code reviewers seeking to understand how modern full-stack web applications are structured in production.

---

## Table of Contents

1. [Architectural Overview & Data Flow](#1-architectural-overview--data-flow)
2. [Technology Stack & Why Each Was Chosen](#2-technology-stack--why-each-was-chosen)
3. [Relational Database Modeling with Prisma & PostgreSQL](#3-relational-database-modeling-with-prisma--postgresql)
4. [Critical Business Logic & Architectural Patterns](#4-critical-business-logic--architectural-patterns)
   - [A. Server-Side Price Recalculation (Zero-Trust Client)](#a-server-side-price-recalculation-zero-trust-client)
   - [B. Concurrency Control & Double-Booking Prevention](#b-concurrency-control--double-booking-prevention)
   - [C. Kitchen Display State Machine](#c-kitchen-display-state-machine)
   - [D. Decoupled Payment Abstraction](#d-decoupled-payment-abstraction)
5. [Security & Authentication Architecture](#5-security--authentication-architecture)
6. [Interactive Frontend Architecture](#6-interactive-frontend-architecture)
7. [Automated Testing Strategy](#7-automated-testing-strategy)
8. [Codebase Directory Walkthrough](#8-codebase-directory-walkthrough)

---

## 1. Architectural Overview & Data Flow

DineDesk follows a decoupled, three-tier client-server architecture:

```mermaid
flowchart TD
    User["Customer / Staff / Admin"] --> Client["React 18 + Vite Frontend (Port 3000)"]
    Client -->|"REST APIs + JSON + JWT Cookies"| API["Express Backend (Port 5050)"]
    
    subgraph Backend_Security_Boundary["Backend Security Boundary"]
        API --> AuthGuard["JWT & RBAC Middleware"]
        AuthGuard --> ZodValidate["Zod Schema Validator"]
        ZodValidate --> Controllers["Domain Controllers"]
        Controllers --> Prisma["Prisma ORM (Data Access Layer)"]
    end
    
    Prisma -->|"Parameterized SQL"| DB[("PostgreSQL 16 Database (Port 5432)")]
```

### The Request Lifecycle
When a user interacts with the application (e.g., placing an order):
1. **Frontend Dispatch:** React validates UI constraints (party size, required fields) and dispatches an HTTP request via Axios with `withCredentials: true`.
2. **Reverse Proxy / CORS:** Vite's development proxy routes `/api` calls directly to `http://localhost:5050`. The Express server enforces CORS restrictions allowing only the configured frontend origin.
3. **Authentication & Authorization:** The `authenticate` middleware inspects the signed HttpOnly cookie or `Authorization: Bearer <token>` header. It validates the cryptographic signature using HMAC-SHA256 and attaches the user payload (`req.user`) to the request.
4. **Input Validation:** Request bodies pass through strict Zod schemas. Invalid payloads (e.g., negative quantities, malformed phone numbers) are rejected immediately with a structured 400 Bad Request error.
5. **Business Logic Execution:** The controller executes domain rules inside database transactions (e.g., querying current prices, locking table availability, creating order items).
6. **Data Persistence:** Prisma translates operations into parameterized SQL queries against PostgreSQL 16.
7. **Response Formatting:** The API returns a consistent JSON response envelope: `{ success: true, data: { ... } }`.

---

## 2. Technology Stack & Why Each Was Chosen

| Layer | Chosen Technology | Why It Was Chosen |
|---|---|---|
| **Frontend Framework** | **React 18 + Vite 5** | Unmatched developer ergonomics, sub-second Hot Module Replacement (HMR), declarative UI state management, and modern component composition. |
| **Styling & Design** | **Tailwind CSS 3** | Utility-first CSS providing a bespoke, cohesive culinary theme (`cream`, `terracotta`, `charcoal`) without bulky CSS runtime overhead. |
| **Type Safety** | **TypeScript 5.x** | End-to-end interface contracts across frontend and backend, catching subtle runtime bugs at compile time. |
| **Backend Framework** | **Node.js 22 LTS + Express 4** | Lightweight, event-driven I/O model ideal for concurrent API requests, extensive ecosystem, and high performance. |
| **Database** | **PostgreSQL 16** | Robust relational database supporting ACID transactions, strict schema constraints, foreign keys, and numeric decimal accuracy. |
| **ORM** | **Prisma 5.22** | Type-safe query building, intuitive schema definition, automated migrations, and built-in connection pooling. |
| **Validation** | **Zod** | Declarative schema validation ensuring incoming client payloads strictly adhere to expected types and ranges before reaching controllers. |

---

## 3. Relational Database Modeling with Prisma & PostgreSQL

The database schema (`server/prisma/schema.prisma`) is modeled according to 3NF (Third Normal Form) principles.

### Key Relational Entities

1. **User:** Stores credentials, full name, phone number, and assigns one of three roles: `CUSTOMER`, `KITCHEN_STAFF`, or `ADMIN`.
2. **MenuCategory & MenuItem:** Menu categories have a 1-to-many relationship with dishes. Each menu item tracks title, description, price, category, vegetarian flag, preparation time, and availability toggle.
3. **RestaurantTable:** Represents physical restaurant tables with fixed seat capacities (`2`, `4`, `6`, `8`) and an `isAvailable` operational flag.
4. **Order & OrderItem:** An order tracks dining type (`DINE_IN`, `TAKEAWAY`, `DELIVERY`), lifecycle status (`PENDING` through `COMPLETED`), delivery address, and notes. Crucially, **`OrderItem` snapshots the exact unit price charged at the moment of purchase**, ensuring future menu price updates never corrupt historical sales ledgers.
5. **Reservation:** Tracks customer bookings for specific dates, time slots, guest counts, and assigned tables.
6. **Payment:** Records payment method (`CARD`, `UPI`, `CASH`), amount, status (`PENDING`, `COMPLETED`, `FAILED`), and unique transaction references.
7. **OrderStatusHistory:** An append-only audit trail logging every status change, timestamp, and optional transition notes.

### Exact Monetary Precision
Floating-point arithmetic in JavaScript and SQL is notoriously prone to rounding errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). In DineDesk:
- Prices and financial totals are stored as PostgreSQL `Decimal(10, 2)`:
  ```prisma
  price Decimal @db.Decimal(10, 2)
  ```
- Subtotals, 5% GST taxes, and delivery charges are calculated using rounded decimal arithmetic, ensuring financial integrity to the exact cent/paisa.

---

## 4. Critical Business Logic & Architectural Patterns

### A. Server-Side Price Recalculation (Zero-Trust Client)
**The Vulnerability:** In insecure applications, the frontend calculates the cart total and submits `{ total: 10.00 }` to the server. Malicious actors can intercept the HTTP payload and modify the price to `$0.01`.

**DineDesk Solution:** The backend adheres to a **Zero-Trust Client Policy**:
1. The client sends *only* an array of item IDs, quantities, and dining mode:
   ```json
   { "items": [{ "menuItemId": "c1...", "quantity": 2 }] }
   ```
2. The server queries the database to retrieve the active prices for each ID.
3. The server validates that all items exist and are marked as `isAvailable: true`.
4. The server re-computes:
   $$\text{Subtotal} = \sum (\text{item.price} \times \text{quantity})$$
   $$\text{GST Tax} = \text{round}(\text{Subtotal} \times 0.05, 2)$$
   $$\text{Total} = \text{Subtotal} + \text{Tax} + \text{DeliveryFee}$$
5. The transaction proceeds using only the server-calculated values.

---

### B. Concurrency Control & Double-Booking Prevention
**The Problem:** Two customers attempting to reserve Table 4 for 7:00 PM on the same date could both receive confirmations if the system checks availability without isolation.

**DineDesk Solution:**
1. A standard dining duration block (e.g., 2 hours) is established.
2. An atomic Prisma transaction (`prisma.$transaction`) checks for overlapping active reservations (`CONFIRMED` or `PENDING`) on suitable tables matching the party size.
3. If all tables matching the required capacity are occupied during the requested time window, the transaction rejects the booking with an HTTP 409 Conflict:
   ```typescript
   if (!availableTable) {
     throw new AppError('No tables available for the selected time and party size.', 409);
   }
   ```
4. Only when a table is securely allocated within the transaction is the reservation committed to PostgreSQL.

---

### C. Kitchen Display State Machine
Kitchen orders must progress through a predictable lifecycle. Invalid status jumps (such as jumping directly from `PENDING` to `COMPLETED` without preparation, or reversing a `COMPLETED` order) undermine operational efficiency.

**The State Transition Graph:**
```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> CONFIRMED : Kitchen accepts order
    CONFIRMED --> PREPARING : Chef starts cooking
    PREPARING --> READY : Food plated on counter
    READY --> COMPLETED : Delivered to customer / table
    PENDING --> CANCELLED : Customer or Staff cancels
    CONFIRMED --> CANCELLED : Customer or Staff cancels
    COMPLETED --> [*]
    CANCELLED --> [*]
```

**Implementation in Controller:**
```typescript
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY],
  READY: [OrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: []
};
```
Any status update violating these allowed transitions is rejected with HTTP 400 Bad Request.

---

### D. Decoupled Payment Abstraction
To satisfy the CodSoft requirement for payment support without demanding live merchant credentials, DineDesk utilizes the **Adapter Pattern**:
- A payment contract interface defines standard operations: `processPayment()`, `verifyPayment()`, `refundPayment()`.
- The `MockPaymentAdapter` implements this interface:
  - Generates realistic transaction references (`TXN-MOCK-XXXXXX`).
  - Supports testing failure scenarios: Sending `{ simulateFailure: true }` triggers an intentional 402 Payment Required decline.
  - Generates audit timestamps and records the payment method (`CARD`, `UPI`, `CASH`).
- In production, a developer can create `StripePaymentAdapter` or `RazorpayPaymentAdapter` implementing the exact same interface without rewriting order controllers.

---

## 5. Security & Authentication Architecture

1. **Password Hashing:** Passwords are hashed with `bcryptjs` using a salt work factor of 10. Raw passwords are never stored in the database.
2. **Stateless JWT with Dual Transport:**
   - Tokens are issued in signed **HttpOnly cookies** (inaccessible to malicious JavaScript, mitigating XSS attacks).
   - In addition, the API supports the standard `Authorization: Bearer <token>` header for headless API consumers and testing tools.
3. **Role-Based Access Control (RBAC):**
   - Routes are secured with granular role guards:
     - `requireRole('ADMIN')` for menu item creation, price editing, and analytics.
     - `requireRole('KITCHEN_STAFF', 'ADMIN')` for kitchen KDS tickets.
     - `authenticate` for customer orders and reservations.
4. **Defensive Parameterized Queries:** Prisma ORM automatically parameterizes all queries, rendering SQL injection impossible.

---

## 6. Interactive Frontend Architecture

1. **Global State via React Context:**
   - `AuthContext`: Tracks authenticated user state, user profile, and exposes one-click demo login shortcuts.
   - `CartContext`: Manages local shopping cart state, quantity manipulation, dining mode selection, and persists selections in `localStorage`.
2. **Responsive Culinary Theme:**
   - Designed using Tailwind CSS with custom palette:
     - Deep Terracotta (`#C2410C`): Primary action accents.
     - Warm Cream (`#FDFBF7`): Background canvas.
     - Slate Charcoal (`#1E293B`): Legible, high-contrast typography.
3. **Real-Time Polling Engine:**
   - To provide live synchronization between customer order tracking and kitchen updates without the operational complexity of WebSocket load-balancers, the frontend uses an intelligent 4-second reactive polling interval with automatic backoff and unmount cleanup.

---

## 7. Automated Testing Strategy

DineDesk includes a comprehensive test suite using **Vitest** and **Supertest** (`server/tests/api.test.ts`) validating 26 integration scenarios:
- **Server Health & CORS Security:** Valid configured origin allowed with credentials, unauthorized origins rejected with HTTP 403.
- **Authentication:** Registration, login with valid credentials, rejection of bad passwords, token verification.
- **Menu System:** Category listing, dish retrieval, availability flags, vegetarian filtering.
- **Order Pipeline:** Server-side price recalculation, order creation, transaction persistence, invalid status rejection, private order authorization (HTTP 401/403).
- **Kitchen Workflow:** KDS queue retrieval, state machine status advancement (`CONFIRMED` → `PREPARING` → `READY`).
- **Reservations & Concurrency:** Table availability queries, party size limits, double-booking rejection, and concurrent serialization with row-level locks.
- **Payments:** Mock payment authorization and simulated decline handling.
- **Admin Metrics:** Revenue calculations and catalog manipulation permissions.

Run tests anytime with:
```powershell
npm run test
```

---

## 8. Codebase Directory Walkthrough

```text
Task2-Restaurant-Ordering/
├── client/                     # Frontend Application
│   ├── src/
│   │   ├── components/         # Reusable UI widgets (Navbar, Footer, MenuCard, Modal)
│   │   ├── context/            # Global Auth and Cart state providers
│   │   ├── pages/              # 7 Full-featured application views:
│   │   │   ├── Home.tsx        # Hero banner, featured dishes, dining info
│   │   │   ├── Menu.tsx        # Digital catalog with search and dietary filters
│   │   │   ├── Cart.tsx        # Line items, dining mode selector, checkout prompt
│   │   │   ├── Checkout.tsx    # Customer details, payment method, order submission
│   │   │   ├── OrderTracker.tsx# Live polling order timeline (PENDING -> COMPLETED)
│   │   │   ├── Kitchen.tsx     # Kitchen display system with status advance buttons
│   │   │   ├── Admin.tsx       # Executive dashboard, dish manager, reservation ledger
│   │   │   └── Reserve.tsx     # Interactive table reservation form
│   │   ├── services/api.ts     # Centralized Axios client with automatic credentials
│   │   └── types/index.ts      # TypeScript models (Order, MenuItem, Reservation, User)
│
├── server/                     # Backend API & Database Service
│   ├── prisma/
│   │   ├── schema.prisma       # Relational models, constraints, and enums
│   │   └── seed.ts             # Pre-seeded dishes, categories, tables, and test users
│   ├── src/
│   │   ├── controllers/        # Domain controllers (auth, menu, orders, kitchen, etc.)
│   │   ├── middleware/         # Auth guards, role checks, Zod validators, error handler
│   │   ├── routes/             # REST endpoint routing definitions
│   │   ├── utils/              # JWT token issuer, AppError class, response helpers
│   │   ├── app.ts              # Express application configuration
│   │   └── server.ts           # Server port listener (5050)
│   └── tests/api.test.ts       # 26 automated integration tests
│
└── docs/                       # Comprehensive Engineering Documentation
    ├── ARCHITECTURE.md         # Detailed architectural blueprint
    ├── API_SPECIFICATION.md    # Complete OpenAPI-style endpoint documentation
    ├── DATABASE_SCHEMA.md      # Data dictionary, relations, and ER diagram
    ├── TESTING_REPORT.md       # Vitest test execution report
    ├── DEMO_VIDEO_OUTLINE.md   # Step-by-step submission video script
    └── LEARNING_GUIDE.md       # This comprehensive engineering guide
```
