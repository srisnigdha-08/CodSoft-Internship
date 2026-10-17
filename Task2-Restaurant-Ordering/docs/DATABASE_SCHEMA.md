# DineDesk — Database Architecture & Entity Relationships

Database Engine: **PostgreSQL 16.4**  
ORM: **Prisma Client (v5.22.0)**  
Database Name: `dinedesk_db`

---

## 1. Entity Relationship Diagram

```
       ┌───────────┐
       │   User    │
       └───┬───┬───┘
           │   │
  1-to-many│   │1-to-many
           │   │
           ▼   ▼
  ┌──────────┐ ┌─────────────┐
  │  Order   │ │ Reservation │
  └────┬─────┘ └──────┬──────┘
       │              │
       │many-to-1     │many-to-1
       ▼              ▼
  ┌──────────────────────────┐
  │     RestaurantTable      │
  └──────────────────────────┘

  ┌──────────────┐             ┌────────────┐
  │ MenuCategory │ 1-to-many   │  MenuItem  │
  └──────┬───────┴────────────►└─────┬──────┘
         │                           │
         │                           │many-to-1
         │                           ▼
  ┌──────▼───────┐             ┌────────────┐
  │    Order     │ 1-to-many   │ OrderItem  │
  └──────┬───────┴────────────►└────────────┘
         │
         │1-to-1
         ▼
  ┌──────────────┐
  │   Payment    │
  └──────────────┘

  ┌──────────────┐ 1-to-many   ┌────────────────────┐
  │    Order     │────────────►│ OrderStatusHistory │
  └──────────────┘             └────────────────────┘
```

---

## 2. Table Specifications

### 2.1 `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Unique user identifier |
| `email` | VARCHAR | UNIQUE, NOT NULL | Account email address |
| `name` | VARCHAR | NOT NULL | User's full name |
| `password` | VARCHAR | NOT NULL | Bcrypt hashed password |
| `phone` | VARCHAR | NULLABLE | Phone number |
| `role` | ENUM | NOT NULL, DEFAULT 'CUSTOMER' | `CUSTOMER`, `KITCHEN_STAFF`, `ADMIN` |
| `createdAt` | TIMESTAMP | DEFAULT now() | Creation timestamp |
| `updatedAt` | TIMESTAMP | AUTO-UPDATE | Modification timestamp |

### 2.2 `menu_categories`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Category identifier |
| `name` | VARCHAR | UNIQUE, NOT NULL | e.g. "Starters & Appetizers" |
| `slug` | VARCHAR | UNIQUE, NOT NULL | e.g. "starters" |
| `description`| TEXT | NULLABLE | Category summary |
| `sortOrder` | INT | DEFAULT 0 | Display ordering |
| `isActive` | BOOLEAN | DEFAULT true | Active flag |

### 2.3 `menu_items`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Item identifier |
| `categoryId` | UUID | Foreign Key -> `menu_categories.id` (ON DELETE CASCADE) |
| `name` | VARCHAR | NOT NULL | Dish name |
| `slug` | VARCHAR | UNIQUE, NOT NULL | URL-safe slug |
| `description`| TEXT | NOT NULL | Detailed ingredients description |
| `price` | DECIMAL(10,2)| NOT NULL | Exact item selling price |
| `imageUrl` | TEXT | NOT NULL | High-resolution food photograph |
| `isVegetarian`| BOOLEAN | DEFAULT false | Pure vegetarian badge flag |
| `isAvailable` | BOOLEAN | DEFAULT true | Real-time kitchen availability flag |
| `preparationTimeMinutes` | INT | DEFAULT 15 | Average preparation time |

### 2.4 `orders`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Order identifier |
| `orderNumber` | VARCHAR | UNIQUE, NOT NULL | Formatted ticket number (e.g. `ORD-XXXXXX-XXX`) |
| `customerId` | UUID | Foreign Key -> `users.id` (ON DELETE SET NULL) |
| `customerName` | VARCHAR | NOT NULL | Customer name |
| `customerEmail`| VARCHAR | NOT NULL | Customer email |
| `customerPhone`| VARCHAR | NOT NULL | Customer contact |
| `orderType` | ENUM | NOT NULL | `DINE_IN`, `PICKUP`, `DELIVERY` |
| `tableId` | UUID | Foreign Key -> `restaurant_tables.id` (ON DELETE SET NULL) |
| `deliveryAddress`| TEXT | NULLABLE | Required for `DELIVERY` orders |
| `status` | ENUM | NOT NULL | `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED` |
| `subtotal` | DECIMAL(10,2)| NOT NULL | Recalculated items total |
| `tax` | DECIMAL(10,2)| NOT NULL | 5% GST |
| `deliveryFee` | DECIMAL(10,2)| DEFAULT 0 | ₹40 if delivery, else 0 |
| `totalAmount` | DECIMAL(10,2)| NOT NULL | Grand total |
| `notes` | TEXT | NULLABLE | Special kitchen instructions |

### 2.5 `order_items`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Line item identifier |
| `orderId` | UUID | Foreign Key -> `orders.id` (ON DELETE CASCADE) |
| `menuItemId` | UUID | Foreign Key -> `menu_items.id` (ON DELETE SET NULL) |
| `name` | VARCHAR | NOT NULL | Captured dish name at order time |
| `price` | DECIMAL(10,2)| NOT NULL | Captured unit price at order time |
| `quantity` | INT | NOT NULL | Number of portions |
| `subtotal` | DECIMAL(10,2)| NOT NULL | Line subtotal (`price * quantity`) |
| `notes` | TEXT | NULLABLE | Item-specific kitchen instructions |

### 2.6 `reservations`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Reservation identifier |
| `reservationNumber` | VARCHAR | UNIQUE, NOT NULL | Reference string (e.g. `RES-XXXXXX-XXX`) |
| `customerId` | UUID | Foreign Key -> `users.id` (ON DELETE SET NULL) |
| `customerName` | VARCHAR | NOT NULL | Guest name |
| `guestCount` | INT | NOT NULL | Number of guests |
| `reservationDate` | VARCHAR | NOT NULL | Date string (`YYYY-MM-DD`) |
| `reservationTime` | VARCHAR | NOT NULL | Time string (`HH:mm`) |
| `tableId` | UUID | Foreign Key -> `restaurant_tables.id` (ON DELETE SET NULL) |
| `status` | ENUM | NOT NULL | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` |

### 2.7 `payments`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | Primary Key | Payment identifier |
| `paymentNumber` | VARCHAR | UNIQUE, NOT NULL | Payment reference |
| `orderId` | UUID | UNIQUE, Foreign Key -> `orders.id` (ON DELETE CASCADE) |
| `amount` | DECIMAL(10,2)| NOT NULL | Exact transaction amount |
| `method` | ENUM | NOT NULL | `CARD`, `UPI`, `CASH`, `MOCK_ONLINE` |
| `status` | ENUM | NOT NULL | `PENDING`, `SUCCESSFUL`, `FAILED`, `REFUNDED` |
| `transactionRef` | VARCHAR | NULLABLE | Gateway transaction reference |
| `gatewayResponse` | TEXT | NULLABLE | JSON log of verified mock response |
