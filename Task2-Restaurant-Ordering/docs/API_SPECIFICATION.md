# DineDesk — REST API Specification (v1)

Base URL: `http://localhost:5050/api/v1`

---

## 1. Authentication Endpoints

### `POST /auth/register`
Creates a new customer account.
- **Request Body:**
  ```json
  {
    "name": "Priya Sharma",
    "email": "priya@example.com",
    "password": "Password@123",
    "phone": "+91 98765 43210"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "data": {
      "user": { "id": "uuid", "name": "Priya Sharma", "email": "priya@example.com", "role": "CUSTOMER" },
      "token": "jwt_token_string"
    }
  }
  ```

### `POST /auth/login`
Authenticates user and returns JWT token and session cookie.
- **Request Body:**
  ```json
  {
    "email": "customer@dinedesk.local",
    "password": "Customer@12345"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": { "id": "uuid", "name": "Priya Sharma", "email": "customer@dinedesk.local", "role": "CUSTOMER" },
      "token": "jwt_token_string"
    }
  }
  ```

### `GET /auth/me`
Retrieves currently authenticated user profile.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** User object.

### `POST /auth/logout`
Clears session cookie and logs out user.

---

## 2. Menu & Category Endpoints

### `GET /categories`
Lists all active menu categories with total item counts.

### `GET /menu`
Retrieves menu items with optional filtering.
- **Query Parameters:**
  - `category` (slug string, e.g. `mains`)
  - `search` (text search against name and description)
  - `vegetarian` (`true` or `false`)
  - `available` (`true` or `false`)
- **Response (200 OK):** Array of menu item objects.

### `GET /menu/:id`
Retrieves a single menu item by ID or slug.

### `POST /menu` (Admin Only)
Creates a new menu item.

### `PATCH /menu/:id` (Admin Only)
Updates an existing menu item (price, availability, description, image).

### `DELETE /menu/:id` (Admin Only)
Deletes a menu item from the catalog.

---

## 3. Order Endpoints

### `POST /orders`
Creates a new customer order with server-side price recalculation.
- **Request Body:**
  ```json
  {
    "customerName": "Priya Sharma",
    "customerEmail": "priya@example.com",
    "customerPhone": "+91 98765 43212",
    "orderType": "DINE_IN",
    "tableId": "uuid-table-id",
    "paymentMethod": "MOCK_ONLINE",
    "notes": "Less spicy please",
    "items": [
      { "menuItemId": "uuid-item-1", "quantity": 2, "notes": "Extra crisp" }
    ]
  }
  ```
- **Response (201 Created):** Full order object including recalculated subtotal, tax, delivery fee, grand total, items, and payment transaction.

### `GET /orders/my`
Retrieves the logged-in customer's order history.

### `GET /orders/:id`
Retrieves order details, items, table, and progress timeline. Enforces ownership check for customers.

### `PATCH /orders/:id/cancel`
Cancels an order if it is still in `PENDING` or `CONFIRMED` state.

---

## 4. Kitchen Operations Endpoints

### `GET /kitchen/orders` (Kitchen Staff & Admin Only)
Retrieves active incoming orders for the kitchen display system (FIFO order).

### `PATCH /kitchen/orders/:id/status` (Kitchen Staff & Admin Only)
Advances order through validated status machine:
- Permitted transitions: `PENDING` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `COMPLETED`.
- Invalid transitions return `400 Bad Request`.

---

## 5. Table Reservations Endpoints

### `GET /reservations/availability`
Checks table availability for a specified date, time, and guest count.
- **Query Parameters:** `date=YYYY-MM-DD&time=HH:mm&guestCount=N`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "available": true,
      "availableTables": [ ... ],
      "totalCapacity": 6
    }
  }
  ```

### `POST /reservations`
Books a table with transaction-level double-booking prevention.

### `GET /reservations/my`
Customer's reservation list.

### `GET /reservations` (Staff & Admin Only)
Master reservation list.

### `PATCH /reservations/:id/status` (Staff & Admin Only)
Updates booking status (`CONFIRMED`, `COMPLETED`, `CANCELLED`).

---

## 6. Payments Endpoints

### `POST /payments/checkout`
Verifies order amount and processes payment via development mock adapter.
- Supports `simulateFailure: true` parameter for QA testing failure paths.

### `GET /payments/:id`
Retrieves payment receipt and gateway response audit.

---

## 7. Admin Endpoints

### `GET /admin/stats` (Admin Only)
Provides real-time metrics: revenue, active orders, today's bookings, popular items.

### `GET /admin/orders` (Admin Only)
Paginated master order list with search filters.

### `GET /admin/users` (Admin Only)
List users and their roles.

### `PATCH /admin/users/:id/role` (Admin Only)
Promotes/updates a user's role (`CUSTOMER`, `KITCHEN_STAFF`, `ADMIN`).
