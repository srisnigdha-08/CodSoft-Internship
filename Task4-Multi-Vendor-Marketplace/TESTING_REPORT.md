# Testing Report

Run date: 10 November 2026, on Windows 11, Node.js 24.14.0 and MongoDB 7.0.45.

## Summary

| Check | Result |
|---|---|
| Backend tests, standalone MongoDB | 127/127 passed |
| Backend tests, replica set with transactions | 127/127 passed |
| Frontend tests | 39/39 passed |
| Backend typecheck | Pass |
| Frontend typecheck | Pass |
| Backend lint | Pass |
| Frontend lint | Pass |
| Backend production build | Pass |
| Frontend production build | Pass |
| Health endpoint, dev server and built server | 200, `{"status":"ok","database":"connected"}` |
| Seed run twice | Same document counts both times |
| Browser walkthrough in Chrome | Passed, no console errors or failed API calls |

## Backend tests

The suite runs against real MongoDB using `codsoft_marketplace_test`.

| File | Tests | Covers |
|---|---|---|
| `auth.test.ts` | 16 | Registration, hashing, cookie flags, login, forged tokens, deactivation, rate limit, health, CORS, error format |
| `products.test.ts` | 25 | Approval gating, price and stock validation, ownership, atomic stock, visibility, search, filters, sort, pagination |
| `cart.test.ts` | 10 | Multi-vendor grouping, server pricing, concurrent adds, stock limits, unavailable items, privacy |
| `checkout.test.ts` | 16 | Rounding, per-vendor delivery, one order per checkout, ignored client totals, price snapshots, overselling race, rollback, order access |
| `payments.test.ts` | 10 | Success, failure, single settlement under concurrency, ownership, no card data, rollback, cancellation |
| `fulfillment.test.ts` | 16 | Vendor isolation, independent status, invalid transitions, races, partial and full refunds, vendor statistics |
| `reviews.test.ts` | 8 | Delivered-purchase rule, duplicates under concurrency, roles, ratings, moderation |
| `admin.test.ts` | 22 | Authorization, approval transitions, self-demotion, role limits, categories, products, statistics |
| `seed.test.ts` | 4 | Test database guard, idempotency, demo logins, multi-vendor data |

Replica-set run: a temporary single-node replica set on port 27118, started separately for this check. MongoDB reported 138 committed and 17 aborted transactions during the run. The aborted transactions include the deliberate failure cases and concurrency tests.

## Frontend tests

These run the real API client, router, providers and pages in jsdom. Only `fetch` is replaced. They do not exercise a real backend.

| File | Tests | Covers |
|---|---|---|
| `auth.test.tsx` | 9 | Login, no browser storage of tokens, errors, protected routes, return after login |
| `catalog.test.tsx` | 11 | Listing, search, filters, sort, pagination, details, stock cap, review eligibility |
| `checkout.test.tsx` | 11 | Vendor grouping, quantity and removal, stock issues, refetch regression, checkout payload, simulated payment, order display |
| `dashboards.test.tsx` | 8 | Vendor statistics, fulfillment actions, inventory, admin statistics, approval, self-protection, order overview |

## Browser walkthrough

A temporary Playwright script, kept outside the repository, drove the running application in Google Chrome against the development database.

| Flow | Result |
|---|---|
| Customer signs in, browses, opens product and store | Pass |
| Adds products from two vendors and sees them grouped in one cart | Pass |
| Checks out and completes simulated payment as one order | Pass |
| Vendor A advances to Shipped; Vendor B confirms | Pass |
| Vendor B cannot see Vendor A's items | Pass |
| Customer sees different statuses per vendor | Pass |
| Admin dashboard and vendor management | Pass |
| Register customer and vendor through the UI | Pass |
| Admin approves new vendor, who creates a product through the form | Pass |
| Stock adjustment through the UI | Pass |
| Failed payment returns items to the cart and releases stock | Pass |
| Review submission removes the review form | Pass |
| No horizontal overflow at 375px and 768px on the pages checked | Pass |
| Auth cookie is HttpOnly and SameSite=Lax; localStorage and sessionStorage empty | Pass |

## Guard checks run by hand

| Check | Result |
|---|---|
| Tests pointed at `codsoft_marketplace` | Refused to start, development data unchanged |
| Seed with `NODE_ENV=production` | Refused |
| Server with empty `JWT_SECRET` | Refused to start |
| Test database after a full run | 0 documents left |

## Defects found during verification

| Defect | Found by | Fix |
|---|---|---|
| Cart page refetched endlessly | Browser walkthrough | Stable callbacks and a regression test |
| Seeded orders all showed today's date | Reviewing screenshots | Seed keeps historic dates, covered by a test |
| Dashboard sidebar stopped short on long pages | Reviewing screenshots | Sticky inner container |
| Sales chart lost the time axis on sparse data | Reviewing screenshots | Every day in the period has a slot |
| Checkout implied a confirmation email is sent | Documentation review | Text corrected |

## Audit re-run, 11 November 2026

An independent audit repeated these checks with no code changes:

| Check | Result |
|---|---|
| Backend tests, standalone | 127/127 |
| Backend tests, replica set | 127/127. This run recorded 138 committed and 25 aborted transactions; the aborted count varies with timing in the concurrency tests |
| Frontend tests | 39/39 |
| Typecheck, lint and build, both packages | Pass |
| Compiled server health | 200, database connected |
| Seed run twice in a disposable database | Identical counts. No duplicate emails, store names or store owners. No broken product, order or review references. The database was dropped afterwards |
| Browser walkthrough plus nine flows | All passed against a disposable database, which was dropped afterwards |
| Live cross-role checks | Vendor B received 403 for Vendor A's product and for admin routes; another customer received 404 for the order |
| Development database | Document counts unchanged by the audit |

## Not covered

- Automated browser tests are not part of the repository. The walkthrough was a one-off verification.
- No load, penetration or cross-browser testing was performed. Only Chrome was used.
- A process crash in the middle of a standalone-mode checkout was not tested. See the limitations in `README.md`.
- `npm audit` reports 10 moderate advisories in each package, all through development tooling (the ESLint dependency chain). `npm audit --omit=dev` reports 0 for both packages.
