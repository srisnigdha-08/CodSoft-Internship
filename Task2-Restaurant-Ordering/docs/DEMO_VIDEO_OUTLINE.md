# Demo Video Outline — DineDesk Restaurant Platform (3–5 minutes)

This outline serves as a step-by-step walkthrough script for the CodSoft Internship Task 2 video submission.

---

## 1. Pre-Recording Checklist

1. **Start PostgreSQL:** Ensure PostgreSQL is running with the `dinedesk_db` database migrated and seeded (`npm run db:migrate`, `npm run db:seed`).
2. **Start Backend Server:** Launch the Express API (`npm run dev:server` in terminal 1) on `http://localhost:5050`.
3. **Start Frontend Client:** Launch the Vite React dev server (`npm run dev:client` in terminal 2) on `http://localhost:3000`.
4. **Browser Setup:** Open `http://localhost:3000` in Google Chrome or Edge at 100% zoom.
5. **No Secrets Shown:** Ensure terminal windows do not expose `.env` credentials, database passwords, or auth tokens.
6. **Use Seed Demo Accounts:** Utilize the pre-seeded accounts or the one-click demo role switcher in the top navigation bar.

---

## 2. Timed Presentation Walkthrough

| Timestamp | Screen / Action | Narration & Key Talking Points |
|---|---|---|
| **0:00 – 0:25** | **Introduction & Architecture Overview**<br>Display the DineDesk Home Page (`http://localhost:3000`). | • Introduce yourself and the project: **DineDesk — Restaurant Ordering & Table Management Platform** built for **CodSoft Task 2**.<br>• State the core problem: Manual pen-and-paper order-taking, reservation conflicts, and kitchen communication friction.<br>• Outline the full-stack architecture: React 18, Vite, TypeScript, Tailwind CSS, Express API, Prisma ORM, and PostgreSQL. |
| **0:25 – 0:55** | **Customer Digital Menu & Search**<br>Open **Digital Menu**. Click categories, search "Paneer", and toggle "Vegetarian Only". | • Show the database-driven digital menu populated with categories: Starters, Main Course, Desserts, and Beverages.<br>• Demonstrate filtering: Category tabs, instant text search, and the Vegetarian dietary toggle.<br>• Highlight dish cards showing prices, preparation times, and vegetarian indicators.<br>• Open a dish modal with the **Quick View** button to view the dish details. |
| **0:55 – 1:35** | **Cart & Server-Side Price Recalculation**<br>Add items to cart. Open the cart, adjust quantities, then proceed to checkout. | • Add items to the cart and view the cart page.<br>• Select dining mode: **Dine-In** (with Table selection), **Pickup**, or **Doorstep Delivery**.<br>• **Key Engineering Point:** Emphasize that the server *never* trusts client-calculated totals. When the order is placed, the Express API queries PostgreSQL directly for current dish prices, computes subtotal, applies 5% GST, adds delivery fees, and ensures transactional consistency. |
| **1:35 – 2:05** | **Checkout & Simulated Payment**<br>Fill customer details on the checkout page and place the order. | • Fill in customer name, phone number, and delivery address.<br>• Select Simulated Online Payment or cash.<br>• State clearly that **payment is simulated**: no gateway is connected and no money moves. Show the "simulate a declined payment" option and the retry on the tracker. |
| **2:05 – 2:40** | **Order Tracker & Polling**<br>The app opens the tracker after checkout. | • Show the order tracking timeline: `PENDING` → `CONFIRMED` → `PREPARING` → `READY` → `COMPLETED`.<br>• Point out the order reference number (`ORD-XXXXXX-XXX`), items ordered, and delivery address.<br>• Note that the page polls the API every 4 seconds, so kitchen updates appear without a manual refresh. |
| **2:40 – 3:15** | **Kitchen Display System (KDS)**<br>Switch role to Kitchen Staff (`kitchen@dinedesk.local`) and open the Kitchen page. | • Demonstrate the dedicated Kitchen Display System used by kitchen chefs and expediters.<br>• Show orders arranged in operational Kanban columns by status: Incoming, Preparing, and Ready for pickup.<br>• Advance the customer's order from `CONFIRMED` to `PREPARING`, then to `READY`. Cash orders start at `PENDING` and show a Confirm Order button first.<br>• Highlight the strict backend state machine: Unauthorized or backward status jumps are strictly rejected by the API. |
| **3:15 – 3:45** | **Table Reservations & Double-Booking Guard**<br>Open **Reservations** as Customer. Select date, time, and guests. | • Select date, dining time slot, number of guests, and special seating requests.<br>• Submit reservation and receive instant confirmation with reference (`RES-XXXXXX-XXX`) and assigned table.<br>• **Double-Booking Guard:** Explain that row locks and a partial unique index in PostgreSQL prevent two active bookings of one table at the same date and time. Mention that bookings have no duration. |
| **3:45 – 4:15** | **Admin Management Center**<br>Switch role to Admin (`admin@dinedesk.local`) and open the Admin page. | • Show executive KPI summary cards: Total Revenue, Active Orders, Table Bookings, Customer Count, and Top Selling Dishes.<br>• Demonstrate **Catalog Governance**: Toggle dish availability (instantly disables adding to cart on the menu) and edit menu prices.<br>• Show the orders ledger, then confirm, complete or cancel a reservation in the reservations ledger. |
| **4:15 – 4:45** | **Automated Integration Tests & Codebase**<br>Show terminal with `npm run test`. | • Run `npm run test` in `server/`: Show the automated integration tests passing against the separate test database (CORS security, Auth, Menu, Orders, Pricing validation, KDS workflow, Reservations concurrency, Payments).<br>• Briefly show the clean code structure: Separation of routes and controllers, Zod validation, Prisma schema, and TypeScript types. |
| **4:45 – 5:00** | **Closing & Summary** | • Conclude the demo by summarizing the achieved goals from the official CodSoft specification.<br>• Thank the evaluators and point to the GitHub repository and technical documentation. |

---

## 3. Recording Tips & Technical Polish

- **Screen Resolution:** Record at 1920x1080 (16:9 ratio).
- **Audio Clarity:** Use an external microphone or headset with clear voice narration; minimize background noise.
- **Two Browser Tabs/Windows:** To demonstrate status polling, place the Customer Order Tracker on the left side of the screen and the Kitchen Display System on the right side. When you advance the order in the KDS, show the customer tracker automatically updating within 4 seconds!
- **Fast Role Switcher (dev server only):** Use the one-click demo pill in the top header (`Admin`, `Kitchen`, `Customer`) to transition smoothly between user views without wasting video time re-typing passwords.
