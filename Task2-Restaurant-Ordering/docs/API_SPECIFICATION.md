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
      "user": { "id": "uuid", "name": "Priya Sharma", "email": "priya@example.com", "role": "CUSTOMER" }
    }
  }
  ```

### `POST /auth/login`
Authenticates the user and sets the JWT in the `dinedesk_token` HttpOnly cookie. The token is not included in the JSON body.
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
      "user": { "id": "uuid", "name": "Priya Sharma", "email": "customer@dinedesk.local", "role": "CUSTOMER" }
    }
  }
  ```

### `GET /auth/me`
Retrieves currently authenticated user profile.
- **Authentication:** `dinedesk_token` cookie, or `Authorization: Bearer <token>` for API tools.
- **Response (200 OK):** User object.

### `POST /auth/logout`
Clears session cookie and logs out user.

---

## 2. Menu & Category Endpoints

### `GET /categories`
Lists all menu categories with total item counts.

### `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id` (Admin Only)
Manage categories. Deleting a category also deletes its menu items.

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
Creates a new order with server-side price recalculation. Quantity must be 1 to 50 per line. `deliveryAddress` is required for `DELIVERY`. Optional `simulatePaymentFailure: true` records a simulated decline for an online payment.
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
Retrieves the logged-in customer's order history. Requires authentication.

### `GET /orders/:id`
Retrieves order details, items, table, and progress timeline. Account orders are limited to their owner and staff. Guest orders are reachable only by UUID, not by order number.

### `PATCH /orders/:id/cancel`
Cancels an order if it is still in `PENDING` or `CONFIRMED` state, using the same access rule. A successful simulated payment becomes `REFUNDED`.

---

## 4. Kitchen Operations Endpoints

### `GET /kitchen/orders` (Kitchen Staff & Admin Only)
Retrieves active incoming orders for the kitchen display system (FIFO order).

### `PATCH /kitchen/orders/:id/status` (Kitchen Staff & Admin Only)
Advances order through validated status machine:
- Permitted transitions: `PENDING` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `COMPLETED`.
- `CANCELLED` is also allowed from any active status.
- Invalid transitions return `400 Bad Request`. A concurrent update returns `409 Conflict`.

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
Books a table for a future date and time. Row locks and a partial unique index reject a second active booking of the same table, date and time with `409 Conflict`.

### `GET /reservations/my`
The signed-in customer's reservation list. Requires authentication.

### `PATCH /reservations/:id/cancel`
Cancels the signed-in customer's own `PENDING` or `CONFIRMED` reservation.

### `GET /reservations` (Staff & Admin Only)
Master reservation list.

### `PATCH /reservations/:id/status` (Staff & Admin Only)
Updates booking status. Allowed: `PENDING` → `CONFIRMED` or `CANCELLED`, and `CONFIRMED` → `COMPLETED` or `CANCELLED`.

---

## 6. Payments Endpoints

### `POST /payments/checkout`
Simulates a payment for an order. No gateway is connected. Account orders are limited to their owner and staff, and `CASH` is rejected.
- `simulateFailure: true` records a declined payment and returns `402`.

### `GET /payments/:id`
Retrieves a simulated payment record, using the same access rule as orders.

---

## 7. Admin Endpoints

### `GET /admin/stats` (Admin Only)
Provides metrics: revenue, active orders, today's bookings, popular items.

### `GET /admin/orders` (Admin Only)
Paginated master order list with search filters.

### `GET /admin/users` (Admin Only)
List users and their roles.

### `PATCH /admin/users/:id/role` (Admin Only)
Updates another user's role (`CUSTOMER`, `KITCHEN_STAFF`, `ADMIN`). Administrators cannot change their own role. The change applies at that user's next login.

---

## 8. Table Endpoints

### `GET /tables`
Lists restaurant tables.

### `POST /tables`, `PATCH /tables/:id`, `DELETE /tables/:id` (Admin Only)
Manage tables. Deletion is refused while the table has active orders or upcoming reservations.
