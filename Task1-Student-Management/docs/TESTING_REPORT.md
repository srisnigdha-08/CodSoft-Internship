# Testing Report

Recorded on 2026-11-10 after the migration to MongoDB, on Windows 11 with Node 24.14.0 and a standalone MongoDB 7.0.45 server.

## Results

| Check | Command (from the project root) | Result |
| --- | --- | --- |
| Frontend tests | `npm test` | 9 of 9 passed, 5 files |
| Backend tests | `npm --prefix .\server test` | 66 of 66 passed, 2 files |
| Frontend typecheck | `npm run typecheck` | Pass |
| Backend typecheck | `npm --prefix .\server run typecheck` | Pass |
| Backend tests and scripts typecheck | `npm --prefix .\server run typecheck:integration` | Pass |
| Frontend lint | `npm run lint` | Pass |
| Backend lint | `npm --prefix .\server run lint` | Pass |
| Frontend production build | `npm run build` | Pass |
| Backend production build | `npm --prefix .\server run build` | Pass |

TypeScript settings were not loosened. The only lint configuration change adds the generated `server/dist` folder to the ignore list.

## Backend test design

The earlier mocked SQL suite and the separate PostgreSQL integration suite were replaced with one suite that runs the real Express routes against a real MongoDB database. Every behavior they covered is retained.

The tests use only `codsoft_student_management_test`:

- The database name is checked before connecting, so even index creation cannot reach another database.
- A non-empty database without the guard marker is refused.
- The marker is rechecked before every cleanup.
- Each file confirms the database holds zero documents when it finishes.

| Area | Covered |
| --- | --- |
| Authentication | Login, wrong password, logout, HttpOnly and SameSite cookie, profile linking, deactivated accounts |
| Authorization | Role, ownership, class scope, foreign origin, manipulated IDs, hiding the existence of other students' fees |
| Students | Create, read, update, deactivate, mass assignment, duplicates, undoing failed creation, search, filter, sort, pagination |
| Teachers and classes | Create, update, deactivate, active-assignment rule, role scope, duplicate sections |
| Attendance | Record, duplicates, class membership, filters, totals beyond the 200 displayed rows |
| Corrections | Audit entry, repeat status rejection, teacher scope, concurrent corrections |
| Exams and results | Validation, duplicates, maximum score, class membership, role scope, pagination |
| Fees and payments | Balances, statuses, totals, overpayment, invalid amounts and records, reference reuse, role scope |
| Dashboard | Aggregates compared with the database for each role, 14-day trend, teacher with no classes |
| Health | Connected (200) and disconnected (503), then recovery |
| MongoDB behavior | ObjectId references, `populate`, all key indexes present, unique indexes on direct writes, five concurrent duplicate attendance writes |
| Query safety | Operator objects in login and bodies, literal search text |
| Money | Integer cents, three concurrent payments, reservation returned on a duplicate reference |
| Safety guards | Seed production block, other-database refusal, URI validation, credential redaction |
| Import transformation | Stable IDs, cents, embedded corrections, reference links, schema validity |

## Seed verification

Run against a temporary project database, which was then dropped.

| | users | students | teachers | classes | attendance | exams | results | fees | payments |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| First run | 166 | 150 | 15 | 10 | 4650 | 30 | 450 | 151 | 101 |
| Second run | 166 | 150 | 15 | 10 | 4650 | 30 | 450 | 151 | 101 |

The newest `updatedAt` on `users` was the same after both runs, so the second run did not rewrite accounts. No duplicate attendance keys or overpaid fees were found, and fee totals equalled payment totals. The seed refused `NODE_ENV=production` and refused a database belonging to another project, whose collections were confirmed unchanged.

## Data migration

The import ran against the actual PostgreSQL database for this project.

| Collection | PostgreSQL rows | MongoDB documents |
| --- | ---: | ---: |
| users | 166 | 166 |
| teachers | 15 | 15 |
| classes | 10 | 10 |
| students | 150 | 150 |
| attendance | 4650 | 4650 |
| embedded corrections | 0 | 0 |
| exams | 30 | 30 |
| results | 450 | 450 |
| fees | 151 | 151 |
| payments | 101 | 101 |

- All 27 verification checks passed, including 13 reference fields with no dangling values.
- Fee obligations (1,264,500,000 cents) and payments (589,500,000 cents) matched exactly.
- A second `--apply` changed nothing and verified again.
- Running the seed on the migrated data added nothing.
- MD5 checksums over every row of all 10 PostgreSQL tables were identical before and after, confirming PostgreSQL was not changed.

The source had no attendance corrections, so that transformation was exercised by a unit test rather than by real rows. PostgreSQL attendance ends on 2026-10-16, so the dashboard's "today" and 14-day trend are correctly empty for the migrated data on the date of this report.

## Live verification

The compiled API (`node dist/index.js`) and the frontend ran in a real browser. The browser pane was in the background, so pages were driven through their DOM rather than with mouse clicks.

**Against the migrated database (reads only):**

| Role | Verified |
| --- | --- |
| Admin | Login, dashboard (150 students, 15 teachers, 450 results, correct fee totals), students, teachers, classes, attendance (4650 total), academics (450 results), fees (151 records), logout |
| Teacher | Login, 31 students across 2 assigned classes, attendance scoped to 961 records, academics, fees API denied (403) |
| Student | Login, dashboard, own profile, 31 attendance rows, 3 results, 2 fee records, student list denied (403), logout |

**Against the test database (writes through the actual forms):** record attendance, correct it and see the audit entry, create an exam, record a result, create a fee, record a partial payment with a decimal amount, and add a student. All succeeded, and the temporary data was then removed.

Teacher write actions were verified by the API test suite rather than in the browser.

**Response times** measured directly against the compiled API on the migrated data ranged from about 20 ms to 400 ms. The slowest was the results page at about 370 ms.

## Screenshots

The existing screenshots in `docs/screenshots/` were kept. The migration did not change page layout or styling, and they were not recaptured. They show the demo data as of the original capture date.
