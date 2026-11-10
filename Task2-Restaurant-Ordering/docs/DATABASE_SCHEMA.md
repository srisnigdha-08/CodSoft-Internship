# DineDesk — MongoDB Data Model

Database engine: **MongoDB** (verified on 7.0)
ODM: **Mongoose 8**
Database: `codsoft_restaurant_ordering` (tests use `codsoft_restaurant_ordering_test`)

Models are defined in `server/src/models`. Every API document exposes `_id` as a string named `id`.

---

## 1. Collections and Relationships

| Collection | Model | Purpose |
|---|---|---|
| `users` | `User` | Accounts and roles |
| `menuCategories` | `MenuCategory` | Menu groupings |
| `menuItems` | `MenuItem` | Dishes |
| `restaurantTables` | `RestaurantTable` | Physical tables |
| `orders` | `Order` | Orders, with line items embedded |
| `payments` | `Payment` | One simulated payment per order |
| `orderStatusHistory` | `OrderStatusHistory` | Status audit trail |
| `reservations` | `Reservation` | Table bookings |

```
users ──< orders >── restaurantTables
users ──< reservations >── restaurantTables
menuCategories ──< menuItems
orders ──1 payments
orders ──< orderStatusHistory >── users (changedBy)
orders { items[] } >── menuItems
```

**Why this shape:** line items are only ever read and written with their order, so they are embedded. Payments, status history and reservations are queried independently and change separately, so they are separate collections linked by ObjectId. There are no database-enforced foreign keys in MongoDB, so controllers verify that referenced documents exist.

---

## 2. Collection Reference

All collections have `_id` (ObjectId). Except where noted, they also have `createdAt` and `updatedAt`.

### `users`
| Field | Type | Rules |
|---|---|---|
| `email` | String | Required, unique, lowercased, trimmed |
| `passwordHash` | String | Required bcrypt hash, excluded from queries by default, never returned by the API |
| `name` | String | Required |
| `phone` | String | Optional |
| `role` | String | `CUSTOMER` (default), `KITCHEN_STAFF`, `ADMIN` |

### `menuCategories`
| Field | Type | Rules |
|---|---|---|
| `name` | String | Required, unique |
| `slug` | String | Required, unique |
| `description` | String | Optional |
| `sortOrder` | Number | Default 0 |
| `isActive` | Boolean | Default true. Stored, but does not hide dishes |

### `menuItems`
| Field | Type | Rules |
|---|---|---|
| `categoryId` | ObjectId → `menuCategories` | Required |
| `name` | String | Required |
| `slug` | String | Required, unique |
| `description` | String | Required |
| `price` | Number | Required, at least 0, in rupees |
| `imageUrl` | String | Absolute URL or local path such as `/images/dish.svg` |
| `isVegetarian` | Boolean | Default false |
| `isAvailable` | Boolean | Default true |
| `preparationTimeMinutes` | Number | Default 15, at least 1 |
| `sortOrder` | Number | Default 0 |

### `restaurantTables`
| Field | Type | Rules |
|---|---|---|
| `tableNumber` | String | Required, unique |
| `capacity` | Number | Required, at least 1 |
| `locationDescription` | String | Optional |
| `isActive` | Boolean | Default true |

### `orders`
`_id` is 96 random bits, because a guest order's id acts as a private link.

| Field | Type | Rules |
|---|---|---|
| `orderNumber` | String | Required, unique, for example `ORD-123456-789` |
| `customerId` | ObjectId → `users` | Null for guest orders |
| `customerName`, `customerEmail`, `customerPhone` | String | Required |
| `orderType` | String | `DINE_IN`, `PICKUP`, `DELIVERY` |
| `tableId` | ObjectId → `restaurantTables` | Dine-in only, optional |
| `deliveryAddress` | String | Required by the API for delivery |
| `status` | String | `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED` |
| `subtotal`, `tax`, `deliveryFee`, `totalAmount` | Number | Calculated by the server, at least 0 |
| `notes` | String | Optional |
| `items` | Embedded array | At least one |

**Embedded `items[]`** (`createdAt` only):

| Field | Type | Rules |
|---|---|---|
| `menuItemId` | ObjectId → `menuItems` | Set to null if the dish is later deleted |
| `name` | String | Snapshot at time of order |
| `price` | Number | Snapshot at time of order |
| `quantity` | Number | At least 1. The API limits it to 50 |
| `subtotal` | Number | Line total |
| `notes` | String | Optional |

### `payments`
Payments are simulated. No gateway is connected and card data is never collected. `_id` is 96 random bits.

| Field | Type | Rules |
|---|---|---|
| `paymentNumber` | String | Required, unique |
| `orderId` | ObjectId → `orders` | Required, unique, so one payment per order |
| `customerId` | ObjectId → `users` | Null for guest orders |
| `amount` | Number | Copied from the order total |
| `method` | String | `CARD`, `UPI`, `CASH`, `MOCK_ONLINE` |
| `status` | String | `PENDING`, `SUCCESSFUL`, `FAILED`, `REFUNDED` |
| `transactionRef` | String | Simulated reference |
| `gatewayResponse` | String | JSON describing the simulated result |

### `orderStatusHistory`
Append-only, `createdAt` only.

| Field | Type | Rules |
|---|---|---|
| `orderId` | ObjectId → `orders` | Required |
| `previousStatus` | String | Null for the first entry |
| `newStatus` | String | Required |
| `changedByUserId` | ObjectId → `users` | Null for guests |
| `notes` | String | Optional |

### `reservations`
| Field | Type | Rules |
|---|---|---|
| `reservationNumber` | String | Required, unique |
| `customerId` | ObjectId → `users` | Null for guest bookings |
| `customerName`, `customerEmail`, `customerPhone` | String | Required |
| `tableId` | ObjectId → `restaurantTables` | Assigned table |
| `guestCount` | Number | 1 to 20 |
| `reservationDate` | String | `YYYY-MM-DD` |
| `reservationTime` | String | `HH:mm` |
| `status` | String | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` |
| `specialRequests` | String | Optional |
| `holdsSlot` | Boolean | Internal. True while the booking occupies its slot. Not returned by the API |

---

## 3. Indexes

Unique indexes also cover their lookups: `users.email`, `menuCategories.name`, `menuCategories.slug`, `menuItems.slug`, `restaurantTables.tableNumber`, `orders.orderNumber`, `payments.paymentNumber`, `payments.orderId`, `reservations.reservationNumber`.

| Collection | Index | Used by |
|---|---|---|
| `users` | `role` | Customer counts |
| `users` | `createdAt` (descending) | Admin user list |
| `menuCategories` | `sortOrder` | Category listing |
| `menuItems` | `categoryId, sortOrder, name` | Category filter |
| `menuItems` | `isVegetarian` | Vegetarian filter |
| `menuItems` | `isAvailable` | Availability filter |
| `menuItems` | `name` | Sorting |
| `menuItems` | `sortOrder, name` | Default menu order |
| `restaurantTables` | `isActive, capacity` | Table allocation |
| `orders` | `customerId, createdAt` (descending) | Order history |
| `orders` | `status, createdAt` | Kitchen board, FIFO |
| `orders` | `createdAt` (descending) | Admin ledger |
| `orders` | `orderType` | Reporting |
| `orders` | `tableId, status` | Active dining orders |
| `orders` | `items.menuItemId` | Clearing links on dish deletion |
| `payments` | `customerId` | Customer payments |
| `orderStatusHistory` | `orderId, createdAt` | Order timeline |
| `reservations` | `customerId, reservationDate, reservationTime` (descending) | Booking history |
| `reservations` | `reservationDate, reservationTime` | Availability, staff lists |
| `reservations` | `status` | Staff filter |
| `reservations` | `tableId, status` | Table counts and deletion checks |

### Double-booking guard

```js
reservationSchema.index(
  { tableId: 1, reservationDate: 1, reservationTime: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true }, name: 'reservations_active_table_slot' }
);
```

Only one active booking can exist per table, date and exact time. Cancelled and completed bookings do not hold a slot. The guard works on standalone servers and replica sets alike. It has no notion of duration, so 19:00 and 19:30 on the same table do not conflict.

---

## 4. Consistency

| Operation | Documents written |
|---|---|
| Create order | Order, payment, status history |
| Change order status | Order, status history, sometimes payment |
| Confirm simulated payment | Payment, order, status history |
| Delete category | Orders (links cleared), dishes, category |
| Delete table | Orders and reservations (links cleared), table |

On a replica set or sharded cluster these run in a MongoDB transaction. A standalone server does not support transactions, so the app performs the writes in sequence and undoes them if a later write fails. That covers application-level failures but not a crash partway through. Use a replica set for full atomicity.

Order status changes are conditional on the status that was read, so concurrent changes cannot both succeed.
