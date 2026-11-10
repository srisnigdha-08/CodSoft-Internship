# DineDesk — Testing Report

Results from the final audit run on 2026-11-10.

## 1. Environment

| Item | Value |
|---|---|
| Node.js | 24.14.0 |
| PostgreSQL | 18.6, on a temporary instance created only for this run |
| Backend test tools | Vitest 2.1.9, Supertest 7 |
| Test database | `dinedesk_test`, created empty, then migrated and seeded by the test setup |

No development database was used.

## 2. Results

| Check | Command | Result |
|---|---|---|
| Backend tests | `npm run test` | 71 passed / 71 |
| TypeScript (server and client) | `npm run typecheck` | Pass |
| TypeScript (test files) | `tsc --noEmit` on `server/tests` | Pass |
| Production builds (server and client) | `npm run build` | Pass |
| Frontend automated tests | None exist | Not applicable |
| Lint | Not configured | Not applicable |

## 3. Backend Test Coverage

All tests are in `server/tests/api.test.ts` and call the Express app against real PostgreSQL.

- **Health and CORS:** configured origin allowed with credentials, other origins (including other localhost ports) rejected, preflight.
- **Authentication:** registration, login, HttpOnly cookie, no token in JSON, cookie-only requests, logout clearing the cookie, expired, wrongly signed and unsigned tokens rejected, bcrypt storage, no self-assigned roles.
- **Authorization:** customers and guests rejected from kitchen and admin endpoints, kitchen staff rejected from admin endpoints, role promotion, no self role change, order and reservation history require sign-in.
- **Menu:** categories, filters, item lookup, invalid input, non-existent category.
- **Orders:** server-side totals that ignore client values, GST, delivery fee, delivery address rules, quantity limits, unknown and sold-out items, repeated dishes, ownership.
- **Lifecycle:** full `PENDING → CONFIRMED → PREPARING → READY → COMPLETED`, status history, rejected jumps, simultaneous updates, customer and kitchen cancellation with simulated refund, cash marked collected on completion.
- **Simulated payments:** decline and retry, double payment rejected, cash rejected online, ownership.
- **Reservations:** availability, invalid and past dates, capacity, double booking, concurrent specific-table and auto-allocated bookings, the database unique index tested directly, no reviving a cancelled booking, cancelling your own booking only.
- **Error handling:** malformed JSON, unknown API routes, invalid query parameters.

## 4. Other Verification

- **Test isolation:** `npm test` refused to run with no `TEST_DATABASE_URL`, with a database name lacking `test`, and with the same database as `DATABASE_URL`.
- **Startup safety:** the server refused to start with no `JWT_SECRET`, and with placeholder secrets when `NODE_ENV=production`. The seed refused to run in production.
- **Migrations:** applied to an empty database. A database created with `prisma db push` and containing data was upgraded with no row loss. `prisma migrate diff` reported no drift from `schema.prisma`.
- **CORS over HTTP:** `curl` confirmed the allowed origin receives credentialed CORS headers and other origins receive 403.
- **Browser walkthrough (development build):** guest restrictions; customer login, session kept after reload; menu filters and search; cart; dine-in cash and delivery checkout; totals matching between cart and server; simulated decline, retry and cancel; order history; reservation and cancellation; kitchen board through all statuses; admin metrics, dish creation, reservation actions, table toggle, role controls; logout. At 375px width, the home, menu, reservation and restricted pages had no horizontal overflow.

## 5. Not Covered

- The frontend has no automated tests. Its behavior was checked manually as listed above.
- The production build was compiled but not deployed or exercised with HTTPS.
