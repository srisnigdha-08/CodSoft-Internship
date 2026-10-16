# CodSoft Internship Tasks

This repository organizes the projects completed for the CodSoft Full Stack Web Development Internship. Each task has its own directory so its source code, setup instructions, and documentation can be reviewed independently.

## Task status

| Task | Project | Status | Technology |
| --- | --- | --- | --- |
| 1 | [Student Management System](Task1-Student-Management/README.md) | Implemented; local verification documented in its README | React, TypeScript, Vite, Node.js, Express, PostgreSQL |
| 2 | Restaurant Ordering System | Planned; implementation not started | Not selected yet |
| 3 | Job Portal | Planned; implementation not started | Not selected yet |
| 4 | Multi-Vendor Marketplace | Planned; implementation not started | Not selected yet |
| 5 | Logistics and Fleet Management | Planned; implementation not started | Not selected yet |

Only Task 1 currently contains an implemented application. The other task folders contain planning notes only; this README does not claim those applications are complete.

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

The Task 1 project uses React 19, TypeScript, Vite, CSS, Node.js, Express, and PostgreSQL. Its exact local commands and database requirements are documented in that task directory.

## Planned tasks

The Task 2–5 names reflect the internship task folders. Their requirements, technology choices, and implementation details have not yet been established in this repository. Each task README records its current planned status; update it as the project is scoped and built.

## Repository hygiene

Local environment files, credentials, dependency folders, generated builds, database dumps, and archive backups are excluded by the root `.gitignore`. Task 1 provides a placeholder-only `server/.env.example`; never commit a real `.env` file or paste credentials into project documentation.