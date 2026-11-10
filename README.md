# CodSoft Internship Tasks

This repository organizes the projects completed for the CodSoft Full Stack Web Development Internship. Each task has its own directory so its source code, setup instructions, and documentation can be reviewed independently.

## Task status

| Task | Project | Status | Technology |
| --- | --- | --- | --- |
| 1 | [Student Management System](Task1-Student-Management/README.md) | Implemented; local verification documented in its README | React, TypeScript, Vite, Node.js, Express, PostgreSQL |
| 2 | [Restaurant Ordering Platform (DineDesk)](Task2-Restaurant-Ordering/README.md) | Implemented; local verification documented in its README | React, TypeScript, Vite, Tailwind CSS, Node.js, Express, PostgreSQL, Prisma |
| 3 | [Job Portal](Task3-Job-Portal/README.md) | Implemented; setup and tests documented in its README | React, TypeScript, Vite, Node.js, Express, MongoDB, Prisma |
| 4 | Multi-Vendor Marketplace | Planned; implementation not started | Not selected yet |
| 5 | Logistics and Fleet Management | Planned; implementation not started | Not selected yet |

Tasks 1, 2, and 3 contain implemented full-stack applications. Tasks 4 and 5 are recorded here as planned; this README does not claim those applications are complete.

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

## Task 3: Job Portal

Task 3 is a full-stack job portal for job seekers, employers, and administrators. It covers profiles and resume uploads, job search with filters and pagination, applications with status history, employer job and applicant management, and admin moderation. Its backend uses Express, MongoDB, and Prisma, with JWT authentication in an HttpOnly cookie. See the [Task 3 README](Task3-Job-Portal/README.md) for setup, environment configuration, API details, tests, and limitations.

## Planned tasks

The Task 4 and 5 names reflect future internship milestones (Multi-Vendor Marketplace, Logistics and Fleet Management). Their requirements and implementation details will be developed in future phases.

## Repository hygiene

Local environment files, credentials, dependency folders, generated builds, database dumps, and archive backups are excluded by the root `.gitignore`. Task 1 provides a placeholder-only `server/.env.example`; never commit a real `.env` file or paste credentials into project documentation.