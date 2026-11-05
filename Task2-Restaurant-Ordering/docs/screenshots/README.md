# DineDesk — Application Screenshots Guide

This guide catalogs the recommended application screens and user journeys to capture for the CodSoft Internship Task 2 submission and project showcase.

---

## Screenshot Checklist

| Screen / Feature | Description | URL / Route |
|---|---|---|
| **1. Customer Home Page** | Hero section with quick links to digital menu, table reservation, and featured chef specials. | `/` |
| **2. Interactive Digital Menu** | Category tabs (Starters, Main Course, Desserts, Beverages), real-time search, and Vegetarian toggle. | `/menu` |
| **3. Dish Quick View Modal** | Detailed nutritional info, allergens, spice level, and Add-to-Cart controls. | `/menu` |
| **4. Shopping Cart & Dining Mode** | Cart items with quantity adjustments, subtotal, and dining mode selection (Dine-In, Takeaway, Delivery). | `/cart` |
| **5. Order Checkout & Payment** | Customer contact form, delivery address, payment method selection, and order breakdown. | `/checkout` |
| **6. Live Order Tracker** | Multi-step progress timeline (`PENDING` → `CONFIRMED` → `PREPARING` → `READY` → `COMPLETED`) with order details. | `/orders/:id` |
| **7. Table Reservation Form** | Date picker, dining time slot selection, party size, and special seating requests. | `/reserve` |
| **8. Kitchen Display System (KDS)** | Operational view showing incoming orders organized by status with one-click status advancement. | `/kitchen` |
| **9. Admin Dashboard & Metrics** | Real-time KPIs (total revenue, active orders, customer count) and catalog management tables. | `/admin` |
| **10. Admin Menu Editor** | Modal for adding/editing dishes, updating prices, and toggling dish availability. | `/admin` |
| **11. Test Suite Pass Verification** | Terminal view showing all 21 automated integration tests passing in Vitest. | Terminal (`npm run test`) |

---

## Capture Guidelines

- **Resolution:** Capture at 1080p (1920x1080) for sharp, professional visual clarity.
- **Demo Data:** Use the pre-seeded demo dishes and demo users (`admin@dinedesk.local`, `kitchen@dinedesk.local`, `customer@dinedesk.local`).
- **Privacy:** Ensure no personal passwords or local system paths are visible in the captured images.
- **Dual-Window Tip:** An impactful screenshot can be created by splitting the screen between the **Customer Order Tracker** on one side and the **Kitchen KDS** on the other to showcase real-time operational synchronization.
