# Learning Guide

This guide explains the ideas in this project and where to read them in the code.

## 1. Modelling one order with many vendors

A single checkout can involve several sellers who ship independently. Each order therefore embeds a `vendorOrders` array with its own items, totals and status. Embedding fits because a shipment has no life outside its order and MongoDB updates a single document atomically.

Read: `server/src/models/Order.ts`.

## 2. Never trust the client with money

The checkout request carries only delivery details. The server reads current prices and works in integer paise, because binary floats cannot represent amounts such as 0.1 exactly.

Read: `server/src/utils/money.ts`, `server/src/services/order.service.ts`.

## 3. Preventing overselling

Checking stock and then saving is a race: two buyers can both pass the check. Putting the condition in the update makes it one atomic step.

Read: `reserveStock` in `order.service.ts`. Test: "does not oversell" in `server/tests/checkout.test.ts`.

## 4. Transactions and compensation

MongoDB transactions need a replica set. `runUnitOfWork` uses one when available and otherwise runs undo steps after a failure. Compensation restores state after an error, but it does not provide isolation, and it cannot help if the process dies.

Read: `server/src/utils/unitOfWork.ts`.

## 5. Authentication versus authorization

Authentication answers "who are you?". Authorization answers "may you do this?". The cookie proves identity, while role checks and ownership-scoped queries decide access. Hiding a button in React protects nothing, so every rule also exists on the server.

Read: `server/src/middleware/auth.ts`, `server/src/routes/products.routes.ts`.

## 6. Why the token is in an HttpOnly cookie

JavaScript cannot read an HttpOnly cookie, so a cross-site scripting bug cannot steal the token. SameSite=Lax stops browsers sending it on cross-site POST requests.

Read: `setAuthCookie` in `auth.ts`.

## 7. State machines

Fulfillment and vendor approval allow only specific changes, listed in a table. The database update also matches the expected current state, so two simultaneous changes cannot both win.

Read: `server/src/services/fulfillment.service.ts`.

## 8. Derived state

An order's overall status is calculated from its parts rather than stored, so it can never drift out of step.

Read: `deriveOrderStatus` in `order.service.ts`.

## 9. Idempotent seeding

The seed upserts on natural keys with `$setOnInsert`, so repeating it changes nothing.

Read: `server/src/seed/seed.ts`.

## 10. Testing against a real database safely

Backend tests use real MongoDB, because indexes and atomic updates are what matter here. A guard refuses any database except `codsoft_marketplace_test`.

Frontend tests replace only `fetch`, so the real router, providers and pages run.

Read: `server/tests/helpers/harness.ts`, `client/src/test/harness.tsx`.

## 11. A bug worth studying

Driving the real app in a browser exposed an infinite loop that the first unit tests missed. A function in the cart context changed identity after every fetch, which re-triggered the effect that called it. The fix was to keep the function stable. A regression test now limits how often the cart loads.

Read: `client/src/hooks/useCart.tsx`.
