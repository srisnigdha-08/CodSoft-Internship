# CodSoft Internship Tasks

This repository organizes the projects completed for the CodSoft Full Stack Web Development Internship. Each task has its own directory so its source code, setup instructions, and documentation can be reviewed independently.

## Task status

| Task | Project | Status | Technology |
| --- | --- | --- | --- |
| 1 | [Student Management System](Task1-Student-Management/README.md) | Implemented; local verification documented in its README | React, TypeScript, Vite, Node.js, Express, PostgreSQL |
| 2 | [Restaurant Ordering Platform (DineDesk)](Task2-Restaurant-Ordering/README.md) | Implemented; local verification documented in its README | React, TypeScript, Vite, Tailwind CSS, Node.js, Express, PostgreSQL, Prisma |
| 3 | Job Portal | Planned; implementation not started | Not selected yet |
| 4 | Multi-Vendor Marketplace | Planned; implementation not started | Not selected yet |
| 5 | Logistics and Fleet Management | Planned; implementation not started | Not selected yet |

Task 1 and Task 2 contain fully implemented full-stack applications. The remaining task folders contain planning notes only.

## Repository structure

```text
CODSOFT_TASKSNO/
├── README.md
├── Task1-Student-Management/
├── Task2-Restaurant-Ordering/
├── Task3-Job-Portal/
├── Task4-Multi-Vendor-Marketplace/
└── Task5-Logistics-Fleet/
```

Git does not retain empty directories, so each planned task folder includes a short README until its project files are added.

## Task 1: Student Management System

Task 1 is a full-stack academic administration application with authentication and role-based access, dashboard statistics, student and teacher records, classes, attendance, academic results, and fee records. Its backend uses PostgreSQL and parameterized SQL. See the [Task 1 README](Task1-Student-Management/README.md) for setup, environment configuration, API details, tests, and limitations.

## Task 2: Restaurant Ordering & Table Management Platform (DineDesk)

Task 2 is a production-grade restaurant platform connecting customers, kitchen staff, and administrators. It features a digital catalog with dynamic filtering, server-side price recalculation, live order tracking with reactive polling, concurrency-controlled table reservations with double-booking prevention, an operational Kitchen Display System (KDS), mock payment abstraction, and an executive administration dashboard. See the [Task 2 README](Task2-Restaurant-Ordering/README.md) for full setup instructions, architecture blueprints, API specifications, and test reports.

## Planned tasks

The Task 3–5 names reflect future internship milestones (Job Portal, Multi-Vendor Marketplace, Logistics and Fleet Management). Their requirements and implementation details will be developed in future phases.

## Repository hygiene

Local environment files, credentials, dependency folders, generated builds, database dumps, and archive backups are excluded by the root `.gitignore`. Task 1 provides a placeholder-only `server/.env.example`; never commit a real `.env` file or paste credentials into project documentation.