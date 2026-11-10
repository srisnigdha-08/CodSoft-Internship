# API Specification

Base URL in development: `http://localhost:5017/api` (the Vite dev server proxies `/api`).

## Conventions

- Requests and responses use JSON.
- Success: `{ "data": ... }`, with an optional `meta` for totals and pagination.
- Error: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`.
- Authentication uses the `sms_session` HttpOnly cookie set by login. Browsers must send credentials.
- **IDs are 24-character hexadecimal strings.** A malformed ID returns 400.
- Dates are `YYYY-MM-DD`. Timestamps are ISO 8601. Money is a decimal number with at most two places.
- Unsafe requests from an `Origin` other than `FRONTEND_ORIGIN` return 403.

| Status | Meaning |
| --- | --- |
| 200 / 201 | Read or update succeeded / record created |
| 400 | Invalid input or an invalid reference |
| 401 | Missing, expired, or inactive session |
| 403 | Not allowed for this role or record |
| 404 | Record not found |
| 409 | Duplicate record or concurrent change |
| 429 | Too many failed sign-ins |
| 503 | Health check could not reach MongoDB |

## Health

### `GET /api/health` — public

```json
{ "data": { "status": "ok", "database": "connected" } }
```

Returns 503 with `DATABASE_UNAVAILABLE` when MongoDB does not answer a ping.

## Authentication

| Method and path | Access | Body | Result |
| --- | --- | --- | --- |
| `POST /api/auth/login` | Public | `email`, `password` | Sets the cookie and returns `{ user }` |
| `POST /api/auth/logout` | Public | — | Clears the cookie |
| `GET /api/auth/me` | Signed in | — | `{ user }` |

```json
{ "data": { "user": { "id": "665f1c2ab1d4e8a3f0c91234", "email": "student@school.local", "role": "student", "studentId": "665f1c2ab1d4e8a3f0c95678" } } }
```

`studentId` or `teacherId` is present for the matching role. Ten failed sign-ins from one address return 429 for ten minutes.

## Dashboard

### `GET /api/dashboard/stats` — signed in

Figures are scoped to the caller: the whole school for administrators, assigned classes for teachers, and the caller's own records for students.

```json
{
  "data": {
    "summary": {
      "totalStudents": 150,
      "totalTeachers": 15,
      "attendance": { "present": 0, "absent": 0, "late": 0, "total": 0, "percentage": 0 }
    },
    "recentStudents": [{ "id": "...", "name": "Jordan Lee", "studentNumber": "S-2026-001", "className": "Grade 10", "registeredAt": "2026-10-15T16:33:00.000Z" }],
    "attendanceTrend": [{ "date": "2026-11-10", "present": 0, "absent": 0, "late": 0, "total": 0, "percentage": 0 }],
    "academics": { "resultCount": 450, "averagePercentage": 72.56, "gradeBands": { "strong": 109, "steady": 147, "support": 194 } },
    "fees": { "obligations": 12645000, "collected": 5895000, "outstanding": 6750000 }
  }
}
```

`totalStudents` is null for students. `totalTeachers` is null for everyone except administrators. `fees` is null for teachers. `attendanceTrend` always has 14 days.

## Students

**Student object:** `id`, `email`, `firstName`, `lastName`, `studentNumber`, `classId`, `className`, `section`, `dateOfBirth`, `phone`, `address`, `status`, `createdAt`.

| Method and path | Access | Notes |
| --- | --- | --- |
| `GET /api/students` | Admin, teacher | Teachers see their assigned classes only |
| `POST /api/students` | Admin | Creates the account and profile |
| `GET /api/students/:id` | Admin, assigned teacher, that student | |
| `PUT /api/students/:id` | Admin | Active students only |
| `DELETE /api/students/:id` | Admin | Deactivates the student and account; history is retained |

List query: `page`, `limit` (up to 50), `search` (name, student number, or email; literal text), `status`, `classId`, `sortBy` (`createdAt`, `name`, `studentNumber`, `class`), `sortOrder` (`asc`, `desc`). `meta` is `{ page, limit, total, pages }`.

Create or update body: `email`, `firstName`, `lastName`, `studentNumber`, and optional `classId`, `dateOfBirth`, `phone`, `address`. Create also requires `password` (at least 10 characters).

## Teachers

**Teacher object:** `id`, `email`, `firstName`, `lastName`, `employeeNumber`, `subject`, `status`, `createdAt`.

| Method and path | Access | Notes |
| --- | --- | --- |
| `GET /api/teachers?search=` | Admin; teacher sees own profile | Up to 100, active only |
| `POST /api/teachers` | Admin | Also requires `password` |
| `GET /api/teachers/:id` | Admin, that teacher | |
| `PUT /api/teachers/:id` | Admin | |
| `DELETE /api/teachers/:id` | Admin | Deactivates the teacher and account |

Body: `email`, `firstName`, `lastName`, `employeeNumber`, `subject`.

## Classes

**Class object:** `id`, `name`, `section`, `teacherId`, `teacherName`, `studentCount` (active students). An inactive teacher appears as unassigned.

| Method and path | Access | Notes |
| --- | --- | --- |
| `GET /api/classes` | Signed in | All for admin, assigned for teacher, own class for student |
| `POST /api/classes` | Admin | Body: `name`, optional `section`, `teacherId` |
| `PUT /api/classes/:id` | Admin | Same body; the teacher must be active |

## Attendance

**Attendance object:** `id`, `studentId`, `studentName`, `studentNumber`, `classId`, `className`, `section`, `date`, `status` (`present`, `absent`, `late`).

| Method and path | Access | Notes |
| --- | --- | --- |
| `GET /api/attendance` | Signed in | Query: `date`, `classId`, `studentId`. Scoped by role |
| `POST /api/attendance` | Admin, assigned teacher | Body: `studentId`, `classId`, `date`, `status` |
| `PUT /api/attendance/:id` | Admin, assigned teacher | Body: `status`. Changes only the status and adds an audit entry |
| `GET /api/attendance/:id/corrections` | Admin, assigned teacher | Newest first |

`GET` returns the latest 200 rows; `meta` is `{ summary: { present, absent, late }, total }` across every matching row. A second record for the same student, class, and date returns 409, as does a correction that loses a race. Setting the status it already has returns 400.

**Correction object:** `id`, `attendanceId`, `previousStatus`, `newStatus`, `correctedBy`, `correctedAt`.

## Academics

**Examination object:** `id`, `title`, `classId`, `className`, `section`, `date`, `maxScore`.

**Result object:** `id`, `studentId`, `studentName`, `studentNumber`, `examinationId`, `examination`, `className`, `date`, `score`, `maxScore`.

| Method and path | Access | Notes |
| --- | --- | --- |
| `GET /api/academics/examinations` | Signed in | Scoped by role |
| `POST /api/academics/examinations` | Admin, assigned teacher | Body: `title`, `classId`, `date`, `maxScore` |
| `GET /api/academics/results?page=&studentId=` | Signed in | 50 per page; `meta` is `{ page, limit, total, pages }` |
| `POST /api/academics/results` | Admin, assigned teacher | Body: `examinationId`, `studentId`, `score` |

The score cannot exceed the exam's maximum, the student must be active in the exam's class, and each student has one result per exam.

## Fees and payments

**Fee object:** `id`, `studentId`, `studentName`, `studentNumber`, `description`, `academicYear`, `amount`, `dueDate`, `amountPaid`, `balance`, `status` (`pending`, `partially paid`, `paid`).

| Method and path | Access | Notes |
| --- | --- | --- |
| `GET /api/fees?studentId=` | Admin, the student concerned | Latest 300; `meta` is `{ total, summary: { obligations, collected, outstanding } }` over all matches |
| `POST /api/fees` | Admin | Body: `studentId`, `description`, `academicYear`, `amount`, `dueDate` |
| `POST /api/fees/:id/payments` | Admin | Body: `amount`, optional `referenceCode` |
| `GET /api/fees/:id/payments` | Admin, the student concerned | A student gets 403 for any fee that is not theirs, including one that does not exist |
| `GET /api/payments?page=&studentId=` | Admin, own records for a student | 50 per page; each row adds `feeRecordId` and `studentId` |

A payment must be positive, have at most two decimal places, and not exceed the outstanding balance (400). A reused reference returns 409. Teachers receive 403 on all fee and payment routes.

**Payment response:** `{ "id", "feeRecordId", "amount", "referenceCode", "paidAt" }`. History rows contain `id`, `amount`, `paidAt`, and `referenceCode`.

## Changes from the PostgreSQL version

| Change | Impact |
| --- | --- |
| IDs are strings, not integers | The frontend was updated; paths and field names are unchanged |
| `GET /api/payments` is new | Additive |
| A correction that loses a race now returns 409 | Previously a row lock made the second request wait |
| Sessions issued before the migration are rejected | Users sign in again |
