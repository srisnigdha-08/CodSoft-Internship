# Architecture

```
React Frontend (Vite, React Router, TypeScript)
      |
      | REST API, JSON, HttpOnly cookie
      v
Express Backend (TypeScript, Zod validation)
      |
      | Mongoose
      v
MongoDB (codsoft_marketplace)
```

In development, Vite serves the client on port 5184 and proxies `/api` to Express on port 4004. Browser and API therefore share an origin.

## Code layout

```
server/src/
  config/      environment validation, database connection, pricing rules
  models/      Mongoose schemas and indexes
  middleware/  authentication, role checks, error handling
  services/    catalog, cart, order, payment, fulfillment and review rules
  routes/      one Express router per resource
  seed/        fictional data and the idempotent seed
  utils/       errors, money, validation, unit of work

client/src/
  api/         fetch wrapper and error handling
  services/    typed functions for each API area
  hooks/       auth, cart, toast, data loading
  layouts/     storefront and dashboard shells
  routes/      route table and role guard
  components/  shared UI
  pages/       public, customer, vendor and admin screens
```

## Authentication

1. The client posts credentials to `/api/auth/login`. Passwords are compared with bcrypt.
2. Express signs an HS256 JWT with `JWT_SECRET` and sets it as the `marketplace_token` cookie: HttpOnly, SameSite=Lax, and Secure when `NODE_ENV=production`.
3. JavaScript never sees the token. The client calls `/api/auth/me` to learn who is signed in.
4. Each protected request verifies the token and reloads the user from MongoDB, so deactivation and role changes apply immediately.

The server will not start without a `JWT_SECRET` of at least 32 characters. There is no fallback.

## Authorization

Authorization happens in the backend at three levels:

| Level | Mechanism |
|---|---|
| Role | `requireRole(...)` on routes |
| Vendor state | `requireApprovedVendor` and ownership checks for product changes |
| Ownership | Queries are scoped to the session's user or vendor id |

The React `ProtectedRoute` only controls navigation. It is not a security boundary.

Requests carrying an `Origin` that is not in `CLIENT_ORIGINS` are refused with 403. Login and registration are rate limited per IP.

## Vendor isolation

- The vendor id always comes from the session, never from the request.
- Vendor order queries match only that vendor, and the response contains only that vendor's shipment.
- A status update matches `{ vendorOrders: { $elemMatch: { vendorId, status: expected } } }` and uses the positional operator. Other vendors' shipments cannot be reached by that update.

## Multi-vendor cart

A customer has one cart, whose lines store `productId`, `vendorId` and `quantity`. The vendor id is copied from the product. Each cart read joins live catalog data, groups lines by vendor and prices each group on the server. Lines that are no longer sellable are flagged and block checkout.

## Order creation

`POST /api/orders` accepts only delivery details:

1. Load the cart with current prices and stock. Reject it if any line has a problem.
2. Group by vendor and calculate tax, delivery and totals in integer paise.
3. Issue an order number.
4. In one unit of work: reserve stock for each line, create the order, create a `PENDING` payment, and empty the cart.

## Inventory and consistency

Stock is reduced by a conditional atomic update:

```js
Product.updateOne(
  { _id, isActive: true, stock: { $gte: quantity } },
  { $inc: { stock: -quantity } },
);
```

If no document matches, the checkout stops with 409. This filter is what prevents overselling, and an automated test races five buyers for one unit.

`runUnitOfWork` (in `server/src/utils/unitOfWork.ts`) detects the MongoDB topology at startup:

| Server | Behaviour |
|---|---|
| Replica set or mongos | A real multi-document transaction |
| Standalone | Writes run in sequence, and registered undo steps run in reverse if a later step throws |

Standalone mode restores state after an application-level failure, but it is not a transaction. Concurrent readers can briefly see intermediate state, and a process crash mid-checkout would not be undone. Both modes pass the same backend test suite.

## Payment simulation

The customer chooses the result of a labelled `SIMULATED PAYMENT`. No card data exists anywhere in the system.

A conditional update moves the payment out of `PENDING`, so an order settles exactly once.

| Result | Effect |
|---|---|
| Success | Payment and order become `PAID`, and vendors can begin fulfillment |
| Failure | Payment `FAILED`, shipments cancelled, stock released, items returned to the cart |

When a vendor cancels a paid shipment, that shipment is restocked and its total is added to `refundedAmount`. The payment becomes `REFUNDED` when everything has been returned.

## Review flow

A customer may review a product only if they have a paid order in which that vendor's shipment containing the product is `DELIVERED`. A unique index on `{ productId, userId }` enforces one review each, including under concurrent requests. Ratings are recalculated from the reviews collection whenever one is added or removed.

## Security measures

- bcrypt password hashing
- JWT in an HttpOnly cookie
- Restricted CORS and an origin check
- Zod validation on every body and query, which also rejects NoSQL operator objects
- Helmet headers and a 100 KB JSON body limit
- Central error handling that never returns stack traces
- Secrets read only from the environment

See the limitations section of `README.md` for what is not covered.
