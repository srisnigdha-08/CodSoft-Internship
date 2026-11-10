# Mela: Multi-Vendor Marketplace

CodSoft Full Stack Web Development Internship, Task 4.

Mela is a marketplace where customers buy from many independent stores in one cart and one checkout. The backend splits each order into a separate shipment per vendor, and each vendor fulfills only its own shipment.

## Features

**Customers**
- Register, sign in and keep a session in an HttpOnly cookie
- Browse with backend search, category, vendor, price, availability and sort filters, with pagination
- Open product details and vendor stores
- Use one cart across vendors, grouped per vendor, with live stock checks
- Check out once with server-calculated tax, delivery and totals
- Complete a clearly labelled simulated payment, with success and failure paths
- Track each vendor's shipment separately
- Review products they have received

**Vendors**
- Register and wait for approval
- See a dashboard, sales, and low-stock counts for their own store
- Create, edit and deactivate products, manage images and assign categories
- Adjust stock atomically
- Move their own shipments through fulfillment, or cancel and refund their share

**Admins**
- See marketplace statistics
- Approve, reject, suspend and reactivate vendors
- Change permitted user roles and deactivate users, with self-demotion blocked
- Manage categories and moderate products
- View all orders with customer, vendors, fulfillment, payment and totals

## Technology

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, CSS |
| Backend | Node.js, Express 5, TypeScript, Zod |
| Database | MongoDB with Mongoose |
| Authentication | JWT in an HttpOnly cookie, bcrypt, role-based authorization |
| Testing | Vitest, Supertest, React Testing Library |

## Architecture

```
React frontend --REST--> Express backend --Mongoose--> MongoDB
```

Details are in [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) and [API_SPECIFICATION.md](API_SPECIFICATION.md).

## MongoDB setup

Run MongoDB locally on port 27017. The application uses two databases of its own, which are created automatically:

- `codsoft_marketplace` for development
- `codsoft_marketplace_test` for tests

A standalone server works. On a replica set, checkout uses real multi-document transactions automatically. See [Limitations](#limitations).

## Environment variables

Copy `server/.env.example` to `server/.env` and set `JWT_SECRET`.

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | Yes | Signing key, at least 32 characters. No default exists |
| `MONGODB_URI` | Yes, outside tests | Development database connection |
| `MONGODB_TEST_URI` | For tests | Must name `codsoft_marketplace_test` |
| `CLIENT_ORIGINS` | Yes | Comma-separated browser origins allowed to call the API |
| `PORT` | No | API port, default 4004 |
| `NODE_ENV` | No | `development`, `test` or `production` |
| `JWT_EXPIRES_IN_HOURS` | No | Session length, default 24 |
| `BCRYPT_ROUNDS` | No | Hashing cost, default 12 |
| `AUTH_RATE_LIMIT_MAX` | No | Login and registration attempts per IP per 15 minutes, default 20 |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Installation

```bash
npm run install:all
```

## Development

Seed the database once, then run the API and the client in separate terminals.

```bash
npm run seed
```

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Open http://localhost:5184. The API listens on http://localhost:4004.

`npm run seed` is safe to repeat. It creates only what is missing and refuses to run in production or against any other database. To sync indexes explicitly, run `npm run db:indexes` in `server/`.

## Demo accounts

All data is fictional.

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | `admin@example.com` | `Admin@12345` | |
| Customer | `customer@example.com` | `Customer@12345` | Has delivered orders |
| Customer | `customer2@example.com` | `Customer@12345` | |
| Vendor A | `vendor1@example.com` | `Vendor@12345` | Aurora Electronics, approved |
| Vendor B | `vendor2@example.com` | `Vendor@12345` | Urban Thread Co., approved |
| Vendor | `vendor3@example.com` | `Vendor@12345` | Hearth & Home Goods, approved |
| Vendor | `vendor4@example.com` | `Vendor@12345` | Trailhead Sports, approved |
| Vendor | `vendor5@example.com` | `Vendor@12345` | Paperleaf Stationers, pending |
| Vendor | `vendor6@example.com` | `Vendor@12345` | QuickDeal Outlet, suspended |

## API overview

| Prefix | Purpose |
|---|---|
| `/api/health` | Service and database status |
| `/api/auth` | Register, login, logout, session |
| `/api/users` | Own profile |
| `/api/vendors` | Public stores and the vendor workspace under `/me` |
| `/api/categories` | Categories |
| `/api/products` | Catalog, product management, stock, reviews |
| `/api/cart` | Multi-vendor cart |
| `/api/orders` | Checkout, history, details |
| `/api/payments` | Simulated payment |
| `/api/reviews` | Create, list own, delete |
| `/api/admin` | Marketplace management |

## Testing

Tests need MongoDB and `MONGODB_TEST_URI`. They clear only the test database, and they refuse to start against any other database.

```bash
npm test
```

Results are in [TESTING_REPORT.md](TESTING_REPORT.md).

## Build

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

Run the built API with `npm start` in `server/`. The client build is in `client/dist`. The API does not serve it, so a deployment needs a web server that serves those files and forwards `/api` to Express on the same origin.

## Screenshots

Real captures from the running application are in [screenshots/](screenshots/).

| | |
|---|---|
| Login | [01-login.png](screenshots/01-login.png) |
| Customer home | [02-customer-home.png](screenshots/02-customer-home.png) |
| Product list | [03-product-list.png](screenshots/03-product-list.png) |
| Product details | [04-product-details.png](screenshots/04-product-details.png) |
| Vendor store | [05-vendor-store.png](screenshots/05-vendor-store.png) |
| Multi-vendor cart | [06-multi-vendor-cart.png](screenshots/06-multi-vendor-cart.png) |
| Checkout | [07-checkout.png](screenshots/07-checkout.png) |
| Order tracking | [08-order-tracking.png](screenshots/08-order-tracking.png) |
| Vendor dashboard | [09-vendor-dashboard.png](screenshots/09-vendor-dashboard.png) |
| Vendor orders | [10-vendor-orders.png](screenshots/10-vendor-orders.png) |
| Admin dashboard | [11-admin-dashboard.png](screenshots/11-admin-dashboard.png) |
| Vendor management | [12-vendor-management.png](screenshots/12-vendor-management.png) |
| Simulated payment | [13-simulated-payment.png](screenshots/13-simulated-payment.png) |
| Vendor sales | [14-vendor-sales.png](screenshots/14-vendor-sales.png) |

## Limitations

- **Payments are simulated.** No gateway exists and no money moves. Refunds are records only.
- **Transactions need a replica set.** On a standalone MongoDB, checkout uses atomic updates with compensating undo steps. These restore state after application errors but give no isolation, and a process crash mid-checkout would not be undone. Overselling is prevented in both modes.
- **Unpaid orders hold stock indefinitely** until the customer pays, fails or cancels. There is no automatic expiry.
- **Checkout empties the whole cart.** An item added from another tab while an order is being placed is removed with the rest and must be added again.
- **Delivery and tax rules are fixed in code:** 18% tax, and Rs 49 delivery per vendor, free from Rs 999.
- **Product images are URLs.** There is no file upload.
- **No email.** There is no email verification, password reset or order notification.
- **CSRF** protection relies on SameSite=Lax cookies and an origin check. There are no CSRF tokens.
- **Rate limiting is in memory**, per process, and covers login and registration only.
- **No admin fulfillment override.** If a vendor owner is deactivated, that store's open shipments cannot be advanced until the account is reactivated.
- **Suspended vendors can still fulfill existing paid orders**, by design, so customers are not stranded.
- **Reviews cannot be edited**, only deleted and rewritten.
- **Seeded historic orders do not reduce stock.** Orders placed in the app do.
- **No deployment has been done.** The app has only been run locally, and no load testing or external security audit has been performed.
