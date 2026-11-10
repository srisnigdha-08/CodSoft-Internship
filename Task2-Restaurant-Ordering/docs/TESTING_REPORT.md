# DineDesk — Testing Report

Results from the MongoDB migration verification on 2026-11-10.

## 1. Environment

| Item | Value |
|---|---|
| Node.js | 24.14.0 |
| MongoDB | 7.0, as both a standalone server and a single-node replica set |
| Backend test tools | Vitest 2.1, Supertest 7 |
| Frontend test tools | Vitest 2.1, Testing Library, jsdom |
| Test database | `codsoft_restaurant_ordering_test` |

## 2. Results

| Check | Command | Result |
|---|---|---|
| Backend tests, replica set (real transactions) | `npm --prefix server run test` | 99 passed / 99 |
| Backend tests, standalone (compensating fallback) | `npm --prefix server run test` | 99 passed / 99 |
| Frontend tests | `npm --prefix client run test` | 18 passed / 18 |
| TypeScript (server and client) | `npm run typecheck` | Pass |
| TypeScript (backend test files) | `tsc --noEmit` on `server/tests` | Pass |
| Production builds (server and client) | `npm run build` | Pass |
| Lint | Not configured | Not applicable |

## 3. Backend Coverage

All tests are in `server/tests/api.test.ts` and call the Express app against real MongoDB.

- **Health and CORS:** `/health`, `/api/health` with a database check, configured and rejected origins, preflight.
- **Authentication:** registration, duplicates, login, HttpOnly cookie, no token in JSON, logout, expired, wrongly signed, unsigned and pre-migration tokens, bcrypt storage, no self-assigned roles, operator objects rejected.
- **Authorization and ownership:** role boundaries for customers, kitchen staff and guests, profile and history scoped to the session, `email` and `userId` parameters ignored, no password data in responses.
- **Menu:** categories, category counts, vegetarian true and false, category combined with vegetarian, literal search text, details by id and slug, invalid input.
- **Orders:** server-side totals that ignore client values, GST, delivery fee, dine-in, pickup, delivery, address rules, quantity limits, unknown and sold-out items, ownership.
- **Lifecycle:** full `PENDING → CONFIRMED → PREPARING → READY → COMPLETED`, status history, rejected jumps, simultaneous updates, customer and kitchen cancellation with simulated refund, cash collected on completion.
- **Simulated payments:** success, decline, retry, double payment rejected, cash rejected online, ownership.
- **Reservations:** availability, invalid and past dates, capacity, double booking, concurrent specific-table and auto-allocated bookings, no reviving cancelled bookings, cancelling your own booking only.
- **Admin:** categories with cascade, dish deletion keeping past orders, tables, reservations, ledger search and pagination, statistics, role promotion, no self role change.
- **MongoDB behaviour:** ObjectId references, embedded items, order and payment relationships, status history, unique constraints, schema validation, index creation including the partial guard, rollback when a payment or history write fails, seed idempotence, seeded image paths.

## 4. Frontend Coverage

- **Cart:** merging, availability, quantity limits, removal, GST, delivery fee, persistence, under React StrictMode.
- **API client:** cookie-only authentication, no identifying parameters on history, validation messages, non-JSON errors.
- **Kitchen page:** restricted for guests and customers, each status action sends the correct next status.

## 5. Other Verification

- **Browser walkthrough:** 43 checks against MongoDB in Chrome, all passing, with no page errors or server errors. Covered registration, login, logout, menu filters, item details, cart, GST and delivery fee, delivery address validation, dine-in, pickup and delivery checkout, simulated success, decline and retry, cancellation, order history, polling tracker, reservations, every kitchen status, role restrictions, and all admin areas.
- **Test isolation:** the suite refuses to run without `MONGODB_TEST_URI`, with a database name lacking `test`, or with the same database as `MONGODB_URI`.
- **PostgreSQL data migration tool:** tested on a temporary PostgreSQL database built from the old schema. All rows were copied and validated, and re-running was safe. PostgreSQL was unchanged, and old accounts could sign in through the API.

## 6. Not Covered

- Lint is not configured.
- The production build was compiled but not deployed or exercised over HTTPS.
- No real pre-existing PostgreSQL data has been migrated by this verification.
