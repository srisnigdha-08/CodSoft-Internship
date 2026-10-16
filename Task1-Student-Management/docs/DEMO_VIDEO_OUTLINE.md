# Demo Video Outline (3–4 minutes)

## Before recording

1. Start PostgreSQL, apply migrations, and run the seed command as described in the README.
2. Start the Express server and Vite frontend in separate PowerShell windows.
3. Open `http://localhost:5173` and sign in with the local administrator demo account.
4. Use only sample data. Do not show a real student's name, contact details, or password.

## Suggested walkthrough

| Time | Screen and talking points |
| --- | --- |
| 0:00–0:20 | Introduce the CodSoft Task 1 Student Management System and the React, Express, TypeScript, and PostgreSQL stack. |
| 0:20–0:45 | Sign in as the administrator. Point out that the session is an HttpOnly cookie and permissions are checked by the API. |
| 0:45–1:10 | Show the dashboard. Explain that the counts and attendance summary come from PostgreSQL. |
| 1:10–1:45 | Open Students, search for a demo record, add a student, open the profile, edit a field, then deactivate the sample profile. Explain soft deactivation preserves history. |
| 1:45–2:10 | Show Teachers and Classes. Explain teacher-to-class assignment and that teacher permissions are limited to assigned classes. |
| 2:10–2:40 | Record one attendance value and show the duplicate-record response for the same student, class, and date. |
| 2:40–3:05 | Show an examination, record a result, and point out the score maximum validation. |
| 3:05–3:25 | Show a fee obligation, a partial payment, and the calculated outstanding balance. Mention that no real payment is processed. |
| 3:25–3:45 | Run the frontend and backend tests, then close with the README and learning guide. |

## Capture notes

- Use a 16:9 screen and keep the browser zoom near 100%.
- Avoid recording `.env`, terminal secrets, and personal records.
- If you cannot create temporary sample data safely, skip destructive actions and show the confirmation dialog instead.
- A separate screenshot checklist is in `docs/screenshots/README.md`.
