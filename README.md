# CodSoft Internship Tasks

This repository holds the projects built for the CodSoft Full Stack Web Development Internship. Each task lives in its own folder, with its own setup instructions, documentation and tests, so it can be reviewed independently.

## Task status

| Task | Project | Status | Technology |
| --- | --- | --- | --- |
| 1 | [Student Management System](Task1-Student-Management/README.md) | Implemented | React, TypeScript, Vite, Node.js, Express, MongoDB, Mongoose |
| 2 | [DineDesk: Restaurant Ordering & Table Management](Task2-Restaurant-Ordering/README.md) | Implemented | React, TypeScript, Vite, Tailwind CSS, Node.js, Express, MongoDB, Mongoose |
| 3 | [Tidewater Jobs: Job Portal](Task3-Job-Portal/README.md) | Implemented | React, TypeScript, Vite, Node.js, Express, MongoDB (replica set), Prisma |
| 4 | [Mela: Multi-Vendor Marketplace](Task4-Multi-Vendor-Marketplace/README.md) | Implemented | React, TypeScript, Vite, Node.js, Express, MongoDB, Mongoose |
| 5 | Logistics and Fleet Management | Planned; implementation not started | Not selected yet |

Tasks 1 to 4 are working full-stack applications. Each one's README documents setup, verification results and known limitations. Task 5 is recorded here as planned only.

## Repository structure

```text
CodSoft-Internship/
├── README.md
├── Task1-Student-Management/
├── Task2-Restaurant-Ordering/
├── Task3-Job-Portal/
├── Task4-Multi-Vendor-Marketplace/
└── Task5-Logistics-Fleet/
```

Git does not keep empty folders, so the planned Task 5 folder holds a short README until its project files are added.

## Task 1: Student Management System

A school administration application for administrators, teachers and students. It covers authentication with role checks on the server, dashboard statistics, student and teacher records, classes, attendance, academic results and fee records. Data is stored in MongoDB through Mongoose.

See the [Task 1 README](Task1-Student-Management/README.md) for setup, API details, tests and limitations.

## Task 2: DineDesk Restaurant Ordering & Table Management

A restaurant platform for customers, kitchen staff and administrators. Customers browse the menu and place dine-in, pickup or delivery orders, with prices recalculated on the server, and book tables with double-booking prevention. The kitchen works through a three-column order board. Administrators manage the menu, tables, reservations and user roles. Payments are simulated. Order status refreshes by polling every 4 seconds; the app does not use WebSockets.

See the [Task 2 README](Task2-Restaurant-Ordering/README.md) for setup, architecture, API specification and test reports.

## Task 3: Tidewater Jobs Job Portal

A job portal for job seekers, employers and administrators. It covers profiles and resume uploads, job search with filters and pagination, applications with status history, employer job and applicant management, and admin moderation.

The backend uses Express with Prisma on MongoDB, and JWT authentication in an HttpOnly cookie. Prisma needs MongoDB running as a replica set.

See the [Task 3 README](Task3-Job-Portal/README.md) for setup, API details, tests and limitations.

## Task 4: Mela Multi-Vendor Marketplace

A marketplace where customers buy from several independent stores in one cart and one checkout. The backend splits each order into a separate shipment per vendor, and each vendor fulfills only its own shipment.

| Area | What it covers |
| --- | --- |
| Inventory | Stock is reduced atomically to prevent overselling |
| Pricing | Tax, delivery and totals are calculated on the server |
| Payments | A clearly labelled simulated payment with success, failure and refund paths |
| Vendors | Approval, product and inventory management, and sales statistics |
| Admins | Vendor approval, user, category and product management, and global order oversight |

Checkout uses MongoDB transactions on a replica set. On a standalone server it falls back to compensating rollback, which is not crash-safe; the README documents this.

See the [Task 4 README](Task4-Multi-Vendor-Marketplace/README.md) for setup, demo accounts, API specification, test results and screenshots.

## Planned task

Task 5, Logistics and Fleet Management, is a future internship milestone. Its requirements and implementation will be developed in a later phase.

## Repository hygiene

The root `.gitignore` excludes local environment files, credentials, dependency folders, generated builds, database dumps and archive backups. Each implemented task provides a placeholder-only `.env.example`. Never commit a real `.env` file or paste credentials into documentation.
