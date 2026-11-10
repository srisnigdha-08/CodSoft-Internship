# API Specification

Base path: `/api`. All request and response bodies are JSON.

## Conventions

**Authentication.** A successful login or registration sets the HttpOnly cookie `marketplace_token`. Browsers send it automatically. No token appears in any response body.

**Auth column.** `Public` needs no session. Otherwise the column names the role that must be signed in.

**Pagination.** List endpoints accept `page` (default 1) and `limit` (default 12, maximum 48, or 20 and 100 where noted) and return:

```json
{ "items": [], "page": 1, "limit": 12, "total": 0, "totalPages": 1 }
```

**Errors.** Every error uses one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid", "details": [{ "path": "email", "message": "Invalid email address" }] } }
```

| Status | Meaning |
|---|---|
| 400 | Malformed JSON, malformed id, empty cart, inactive category |
| 401 | No session, or the session is invalid or expired |
| 403 | Wrong role, not the owner, unapproved vendor, deactivated account, disallowed origin |
| 404 | Not found, or an order or payment that belongs to someone else |
| 409 | Duplicate value, insufficient stock, invalid status change, payment already processed |
| 422 | Body or query failed validation |
| 429 | Too many login or registration attempts |
| 500 | Unexpected error. The response never contains a stack trace |
| 503 | Health check only: database disconnected |

Fields not listed for a request body are ignored. That includes `role`, `price` on cart requests, `vendorId`, and every monetary field at checkout.

## Health

| Method | Route | Auth | Response |
|---|---|---|---|
| GET | `/health` | Public | `200 { "status": "ok", "database": "connected" }`, or `503 { "status": "degraded", "database": "disconnected" }` |

## Authentication: `/auth`

| Method | Route | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | See below | `201 { user, vendor }` | 409, 422, 429 |
| POST | `/auth/login` | Public | `{ email, password }` | `200 { user, vendor }` | 401, 403, 422, 429 |
| POST | `/auth/logout` | Public | None | `204` | None |
| GET | `/auth/me` | Any role | None | `200 { user, vendor }` | 401, 403 |

`vendor` is `{ _id, businessName, approvalStatus }` for vendor accounts and `null` otherwise.

Registration body:

```json
{
  "accountType": "CUSTOMER",
  "name": "Riya",
  "email": "riya@example.com",
  "password": "8-72 chars, upper, lower and digit",
  "phone": "+91 90000 00000"
}
```

With `"accountType": "VENDOR"`, add:

```json
{ "vendor": { "businessName": "My Store", "description": "", "contactEmail": "", "phone": "", "address": { "line1": "", "line2": "", "city": "", "state": "", "postalCode": "", "country": "India" } } }
```

`ADMIN` cannot be registered. Vendors start as `PENDING`.

## Users: `/users`

| Method | Route | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/users/me` | Any role | None | `200 { user }` | 401 |
| PATCH | `/users/me` | Any role | `{ name?, phone? }` | `200 { user }` | 401, 422 |

## Categories: `/categories`

| Method | Route | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/categories` | Public | None | `200 { items }`, active only | None |
| POST | `/categories` | ADMIN | `{ name, description?, image?, isActive? }` | `201 { category }` | 401, 403, 409, 422 |
| PATCH | `/categories/:id` | ADMIN | Any of the same fields | `200 { category }` | 400, 401, 403, 404, 409, 422 |

Names are unique regardless of case.

## Products: `/products`

| Method | Route | Auth | Body or query | Success | Errors |
|---|---|---|---|---|---|
| GET | `/products` | Public | Query below | `200` paginated products | 422 |
| GET | `/products/:id` | Public | None | `200 { product }` | 400, 404 |
| GET | `/products/:id/reviews` | Public | `page`, `limit` | `200` paginated reviews with `authorName` | 400, 404 |
| GET | `/products/:id/review-eligibility` | CUSTOMER | None | `200 { canReview, hasReviewed }` | 400, 401, 403 |
| POST | `/products` | Approved VENDOR | Product body | `201 { product }` | 400, 401, 403, 409, 422 |
| PATCH | `/products/:id` | Owning approved VENDOR, or ADMIN | Product fields except `stock` | `200 { product }` | 400, 401, 403, 404, 409, 422 |
| PATCH | `/products/:id/stock` | Owning approved VENDOR, or ADMIN | `{ adjustment }`, a non-zero integer | `200 { product }` | 400, 401, 403, 404, 409, 422 |
| DELETE | `/products/:id` | Owning approved VENDOR, or ADMIN | None. Sets `isActive` to false | `204` | 400, 401, 403, 404 |

**List query.** `q`, `category`, `vendor`, `minPrice`, `maxPrice`, `inStock` (`true` or `false`), `sort` (`newest`, `price_asc`, `price_desc`, `rating`, `name`), `page`, `limit`.

**Public visibility.** A product is public only when it is active, its vendor is `APPROVED` and its category is active.

**Product body.**

```json
{ "name": "Teapot", "description": "At least 10 characters", "price": 899.5, "stock": 12, "sku": "TEA-001", "categoryId": "<id>", "images": ["/catalog/teapot.svg"], "isActive": true }
```

`price` has at most 2 decimals. `sku` is unique within a vendor. `vendorId` always comes from the session.

## Vendors: `/vendors`

| Method | Route | Auth | Body or query | Success | Errors |
|---|---|---|---|---|---|
| GET | `/vendors` | Public | `page`, `limit` | `200` paginated approved stores with `productCount` | 422 |
| GET | `/vendors/:id` | Public | None | `200 { vendor }` | 400, 404 |
| GET | `/vendors/me` | VENDOR | None | `200 { vendor }` | 401, 403 |
| PATCH | `/vendors/me` | VENDOR | `{ businessName?, description?, logo?, contactEmail?, phone?, address? }` | `200 { vendor }` | 401, 403, 409, 422 |
| GET | `/vendors/me/dashboard` | VENDOR | None | `200` counts and `revenue` | 401, 403 |
| GET | `/vendors/me/sales` | VENDOR | `days` (1 to 365, default 30) | `200 { days, totalRevenue, totalOrders, daily, topProducts }` | 401, 403, 422 |
| GET | `/vendors/me/products` | VENDOR | `page`, `limit` (max 100), `q` | `200` paginated, including inactive | 401, 403, 422 |
| GET | `/vendors/me/products/:productId` | VENDOR | None | `200 { product }` | 400, 401, 403, 404 |
| GET | `/vendors/me/orders` | VENDOR | `page`, `limit`, `status` | `200` paginated vendor views | 401, 403, 422 |
| GET | `/vendors/me/orders/:orderId` | VENDOR | None | `200 { order }` | 400, 401, 403, 404 |
| PATCH | `/vendors/me/orders/:orderId/status` | VENDOR | `{ status, note? }` | `200 { order }` | 400, 401, 403, 404, 409, 422 |

A vendor order view contains `_id`, `orderNumber`, `createdAt`, `paymentStatus`, `contact`, `shippingAddress` and `fulfillment` (that vendor's shipment only).

Allowed fulfillment changes:

| From | To |
|---|---|
| PENDING | CONFIRMED, CANCELLED |
| CONFIRMED | PROCESSING, CANCELLED |
| PROCESSING | SHIPPED, CANCELLED |
| SHIPPED | DELIVERED |
| DELIVERED, CANCELLED | None |

Only `PAID` orders can be fulfilled. Cancelling restocks that shipment and records a refund of its total.

## Cart: `/cart` (CUSTOMER)

| Method | Route | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/cart` | None | `200 { cart }` | 401, 403 |
| POST | `/cart/items` | `{ productId, quantity? }`, quantity 1 to 99 | `201 { cart }` | 401, 403, 404, 409, 422 |
| PATCH | `/cart/items/:productId` | `{ quantity }` | `200 { cart }` | 400, 401, 403, 404, 409, 422 |
| DELETE | `/cart/items/:productId` | None | `200 { cart }` | 400, 401, 403, 404 |

```json
{
  "vendors": [{
    "vendor": { "_id": "...", "businessName": "Vendor A" },
    "items": [{ "productId": "...", "name": "...", "image": "...", "unitPrice": 500, "quantity": 2, "lineTotal": 1000, "stock": 10, "issue": null }],
    "totals": { "subtotal": 1000, "tax": 180, "deliveryFee": 0, "total": 1180 }
  }],
  "totals": { "subtotal": 1000, "tax": 180, "deliveryFee": 0, "grandTotal": 1180 },
  "itemCount": 2,
  "canCheckout": true
}
```

`issue` is `null`, `UNAVAILABLE` or `INSUFFICIENT_STOCK`.

## Orders: `/orders`

| Method | Route | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/orders` | CUSTOMER | `{ fullName, phone, address }` | `201 { order }` | 400, 401, 403, 409, 422 |
| GET | `/orders` | CUSTOMER | `page`, `limit` | `200` paginated own orders | 401, 403, 422 |
| GET | `/orders/:id` | Owning CUSTOMER, or ADMIN | None | `200 { order, payment }` | 400, 401, 403, 404 |
| POST | `/orders/:id/cancel` | Owning CUSTOMER | None. Unpaid orders only | `200 { order }` | 400, 401, 403, 404, 409 |

An order includes `orderNumber`, `contact`, `shippingAddress`, `vendorOrders[]`, `subtotal`, `tax`, `deliveryFee`, `grandTotal`, `paymentStatus` and a derived `status`: `AWAITING_PAYMENT`, `PAYMENT_FAILED`, `IN_PROGRESS`, `COMPLETED` or `CANCELLED`.

**Pricing.** Tax is 18% of each vendor's subtotal. Delivery is Rs 49 per vendor and free when that vendor's subtotal is at least Rs 999.

## Payments: `/payments` (simulated only)

| Method | Route | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/payments/simulate` | Owning CUSTOMER | `{ orderId, outcome }`, outcome `SUCCESS` or `FAILURE` | `200 { label: "SIMULATED PAYMENT", payment, order }` | 400, 401, 403, 404, 409, 422 |
| GET | `/payments/order/:orderId` | Owning CUSTOMER, or ADMIN | None | `200 { label, payment }` | 400, 401, 403, 404 |

`FAILURE` releases stock, cancels the shipments and returns the items to the cart.

## Reviews: `/reviews`

| Method | Route | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/reviews` | CUSTOMER with a delivered purchase | `{ productId, rating, title?, comment }` | `201 { review }` | 400, 401, 403, 409, 422 |
| GET | `/reviews/mine` | CUSTOMER | None | `200 { items }` | 401, 403 |
| DELETE | `/reviews/:id` | Author, or ADMIN | None | `204` | 400, 401, 403, 404 |

`rating` is a whole number from 1 to 5. Each customer may review a product once.

## Admin: `/admin` (ADMIN)

| Method | Route | Body or query | Success | Errors |
|---|---|---|---|---|
| GET | `/admin/dashboard` | None | `200 { users, vendors, pendingVendors, products, activeProducts, orders, revenue }` | 401, 403 |
| GET | `/admin/vendors` | `status`, `q`, `page`, `limit` (max 100) | `200` paginated, with `owner` | 401, 403, 422 |
| PATCH | `/admin/vendors/:id/status` | `{ status, note? }` | `200 { vendor }` | 400, 401, 403, 404, 409, 422 |
| GET | `/admin/users` | `q`, `page`, `limit` (max 100) | `200` paginated | 401, 403, 422 |
| PATCH | `/admin/users/:id` | `{ role?, status? }`, role `CUSTOMER` or `ADMIN` | `200 { user }` | 400, 401, 403, 404, 422 |
| GET | `/admin/categories` | None | `200 { items }`, including inactive | 401, 403 |
| GET | `/admin/products` | `q`, `page`, `limit` (max 100) | `200` paginated, including inactive | 401, 403, 422 |
| GET | `/admin/orders` | `paymentStatus`, `q`, `page`, `limit` (max 100) | `200` paginated full orders | 401, 403, 422 |

Vendor approval changes: `PENDING` to `APPROVED` or `REJECTED`; `APPROVED` to `SUSPENDED`; `SUSPENDED` to `APPROVED` or `REJECTED`; `REJECTED` to `APPROVED`.

Admins cannot change their own role or status, and vendor accounts keep the `VENDOR` role. Deactivating a vendor owner suspends their store. `revenue` is paid amounts minus refunds.
