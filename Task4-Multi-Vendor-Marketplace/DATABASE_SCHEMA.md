# Database Schema

The application uses MongoDB through Mongoose. Models are in `server/src/models`.

| Database | Purpose |
|---|---|
| `codsoft_marketplace` | Development data |
| `codsoft_marketplace_test` | Automated tests only |

All main collections have `createdAt` and `updatedAt` timestamps except `counters`.

## Relationships

```
users 1---0..1 vendors 1---* products *---1 categories
users 1---0..1 carts      (embedded items reference products and vendors)
users 1---* orders 1---1 payments
orders embed vendorOrders[], one per vendor, each with items[] and statusHistory[]
reviews reference products, users and the qualifying order
```

## users

| Field | Type | Rules |
|---|---|---|
| `name` | String | Required, 2 to 80 characters |
| `email` | String | Required, lowercased, unique |
| `passwordHash` | String | Required bcrypt hash, excluded from queries by default and removed from JSON |
| `role` | String | `CUSTOMER`, `VENDOR`, `ADMIN` |
| `phone` | String | Optional |
| `status` | String | `ACTIVE`, `DEACTIVATED` |

Indexes: `{ email: 1 }` unique; `{ role: 1, status: 1 }`.

## vendors

| Field | Type | Rules |
|---|---|---|
| `userId` | ObjectId to users | Required, unique |
| `businessName` | String | Required, unique regardless of case |
| `description`, `logo` | String | Optional |
| `contactEmail` | String | Required |
| `phone` | String | Optional |
| `address` | Embedded | `line1`, `line2?`, `city`, `state`, `postalCode`, `country` |
| `approvalStatus` | String | `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED` |
| `approvalNote` | String | Optional admin note |

Indexes: `{ userId: 1 }` unique; `{ businessName: 1 }` unique with a case-insensitive collation; `{ approvalStatus: 1, createdAt: -1 }`.

## categories

| Field | Type | Rules |
|---|---|---|
| `name` | String | Required, unique regardless of case |
| `description`, `image` | String | Optional |
| `isActive` | Boolean | Default true |

Indexes: `{ name: 1 }` unique with a case-insensitive collation; `{ isActive: 1 }`.

## products

| Field | Type | Rules |
|---|---|---|
| `vendorId` | ObjectId to vendors | Required |
| `categoryId` | ObjectId to categories | Required |
| `name`, `description` | String | Required |
| `images` | [String] | URLs or root-relative paths |
| `price` | Number | 0.01 to 10,000,000, at most 2 decimals |
| `stock` | Number | Whole number, minimum 0 |
| `sku` | String | Uppercased, unique per vendor |
| `isActive` | Boolean | Default true |
| `rating`, `reviewCount` | Number | Recalculated from reviews |

Indexes: `{ vendorId: 1, sku: 1 }` unique; `{ vendorId: 1, isActive: 1 }`; `{ categoryId: 1, isActive: 1, price: 1 }`; `{ isActive: 1, createdAt: -1 }`; `{ isActive: 1, rating: -1 }`; `{ name: 1 }`; `{ sku: 1 }`.

## carts

One cart per customer. Prices are not stored here; they are read from `products`.

| Field | Type | Rules |
|---|---|---|
| `customerId` | ObjectId to users | Required, unique |
| `items[]` | Embedded | `productId`, `vendorId`, `quantity` (1 to 99) |

Index: `{ customerId: 1 }` unique.

## orders

One document per checkout. Vendor fulfillment is embedded, so an order and all of its shipments are read and updated together.

| Field | Type | Rules |
|---|---|---|
| `orderNumber` | String | Required, unique |
| `customerId` | ObjectId to users | Required |
| `contact` | Embedded | `fullName`, `email`, `phone` |
| `shippingAddress` | Embedded | Same shape as a vendor address |
| `vendorOrders[]` | Embedded | At least one, described below |
| `subtotal`, `tax`, `deliveryFee`, `grandTotal` | Number | Calculated by the server |
| `paymentStatus` | String | `PENDING`, `PAID`, `FAILED`, `REFUNDED` |

Each `vendorOrders[]` element:

| Field | Type | Rules |
|---|---|---|
| `_id` | ObjectId | Generated |
| `vendorId` | ObjectId to vendors | Required |
| `vendorName` | String | Snapshot |
| `items[]` | Embedded | `productId`, `name`, `sku`, `image`, `unitPrice`, `quantity`, `lineTotal` |
| `subtotal`, `tax`, `deliveryFee`, `total` | Number | That vendor's amounts |
| `status` | String | `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED` |
| `statusHistory[]` | Embedded | `status`, `actor` (`SYSTEM`, `CUSTOMER`, `VENDOR`, `ADMIN`), `at`, `note?` |

The item fields are deliberate snapshots, so later catalog edits cannot change a past order. The overall order status is not stored. The API derives it from `paymentStatus` and `vendorOrders[].status`, so the two cannot disagree.

Example:

```json
{
  "orderNumber": "MKT-1001",
  "paymentStatus": "PAID",
  "grandTotal": 2596,
  "vendorOrders": [
    { "vendorName": "Vendor Alpha", "status": "SHIPPED", "total": 1180, "items": [{ "name": "Product A1", "quantity": 2 }] },
    { "vendorName": "Vendor Beta", "status": "CONFIRMED", "total": 1416, "items": [{ "name": "Product B1", "quantity": 1 }] }
  ]
}
```

Indexes: `{ orderNumber: 1 }` unique; `{ customerId: 1, createdAt: -1 }`; `{ "vendorOrders.vendorId": 1, createdAt: -1 }`; `{ "vendorOrders.items.productId": 1, customerId: 1 }`; `{ paymentStatus: 1, createdAt: -1 }`.

## payments

Simulated only. No card or bank data is accepted or stored.

| Field | Type | Rules |
|---|---|---|
| `orderId` | ObjectId to orders | Required, unique |
| `customerId` | ObjectId to users | Required |
| `amount`, `refundedAmount` | Number | Minimum 0 |
| `currency` | String | `INR` |
| `method` | String | Only `SIMULATED` |
| `status` | String | `PENDING`, `PAID`, `FAILED`, `REFUNDED` |
| `reference` | String | `SIM-` prefixed |
| `failureReason` | String | Optional |
| `processedAt` | Date | Set on settlement |

Indexes: `{ orderId: 1 }` unique; `{ customerId: 1, createdAt: -1 }`; `{ status: 1 }`.

## reviews

| Field | Type | Rules |
|---|---|---|
| `productId` | ObjectId to products | Required |
| `userId` | ObjectId to users | Required |
| `orderId` | ObjectId to orders | The qualifying delivered order |
| `rating` | Number | Whole number, 1 to 5 |
| `title` | String | Optional |
| `comment` | String | Required, 3 to 2000 characters |

Indexes: `{ productId: 1, userId: 1 }` unique; `{ productId: 1, createdAt: -1 }`; `{ userId: 1, createdAt: -1 }`.

## counters

Added for readable order numbers. `_id` is the sequence name and `seq` increases atomically with `$inc`. An order number can be skipped if checkout fails after the number is issued.

## Index setup

Mongoose builds indexes automatically on first use. `npm run db:indexes` in `server/` brings them in line with the schemas explicitly.

## Seed data

`npm run seed` uses upserts on natural keys with `$setOnInsert`. It deletes nothing and never overwrites existing records. It refuses to run when `NODE_ENV=production` or against any database other than `codsoft_marketplace`.
