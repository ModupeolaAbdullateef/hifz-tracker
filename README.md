# Hifz Progress Tracker — Mosg Abertawe

A mobile-first web app that replaces the weekly Excel sheet for Swansea Mosque's
10-week Hifz class. Teachers log a student's weekly progress; students and
parents look up progress with a student code; an admin manages the class.

Built with Vite + React + TypeScript, Supabase (Postgres + RPC functions), and
hosted on GitHub Pages via GitHub Actions.

## For teachers

1. Go to the site and click **Staff login** at the bottom of the home page.
2. Enter your name and the **teacher access code** (ask the admin if you don't
   have it).
3. **Find student**: search a student by name, tap their name, then tap
   **Fill week N** (or tap any week column in their grid) to open the entry
   panel.
4. **This Thursday**: pick a week (defaults to the current one) to see the
   whole class with who's done/not done. Tap a name to fill it in; use
   **Save & next student** to move through the list quickly.
5. In the entry panel: toggle **Present/Absent** (absent hides the other
   fields and marks the week red), fill in New Hifz / Old Hifz / Revision /
   Tajweed, toggle **Good week** if it was a strong week (marks it green),
   and add a note or next assignment if useful.
6. **Class overview** shows totals, attendance %, and an on-track/behind
   indicator for every student.
7. Sessions last 12 hours, then you'll need to log in again.

## For students and parents

1. Go to the site, type the student's first name under **Find my record**,
   pick the right name, then enter the **student code** given by the teacher
   (e.g. `HZ-4821`).
2. The progress page shows the weekly grid, totals, a progress ring against
   the target (if one is set), a chart of New Hifz per week, the latest
   teacher note and next assignment, and any badges earned.
3. After week 10 (or once the target is reached), a **certificate** becomes
   available to view and print.

## For the admin (lead teacher)

Admin tabs appear automatically after logging in with the **admin access
code** instead of the teacher code.

- **Students**: add a student (a code like `HZ-4821` is generated
  automatically), edit their name/join week/target, deactivate or reactivate
  them, or generate a new code if one is lost.
- **Course**: change the course name, start date, number of weeks, or default
  target; mark a week as cancelled (e.g. for a holiday) — this doesn't delete
  any existing records.
- **Fields**: rename a field's label, change its type (number / yes-no),
  reorder fields, or deactivate one. Existing recorded data is never deleted
  when a field is renamed or deactivated.
- **Tips**: add, edit, reorder, or deactivate the tips shown on the student
  pages' scrolling banner. Category `announcement` is styled differently to
  stand out.
- **Codes**: change the teacher and/or admin access code at any time. Leave a
  field blank to keep it unchanged. Existing logged-in sessions stay valid
  until they expire (up to 12 hours) — this is intentional so no one gets
  logged out mid-class.
- **Export**: download a CSV with one row per student per week and one
  column per field, for backup or reporting.

### Changing the brand colours

All colours live in `src/styles/theme.css` as CSS custom properties
(`--brand-primary`, `--brand-secondary`, `--status-absent`, `--status-good`,
etc.). Edit the values there, commit, and push — the next deploy picks them
up automatically. The current values are placeholders; swap them for Swansea
Mosque's actual brand colours (and swap the Google Fonts import in
`index.html` if the font should change too).

## Database / security model

- Every table has Row Level Security enabled with **no policies for the
  anon role** — the browser's anon key cannot read or write any table
  directly (verified in testing: direct REST queries return
  `permission denied`).
- All reads and writes go through Postgres functions
  (`supabase/setup.sql`), each `SECURITY DEFINER` with an explicit
  `search_path`, callable only via `supabase.rpc(...)`.
- Teacher and admin actions are gated by a session token (checked for role
  and expiry on every call) rather than by a separate Postgres role, since
  the browser only ever has the anon key.
- Login codes are stored hashed (`pgcrypto`), never in plain text.
- Failed login/code attempts are rate-limited (10 failures / 15 minutes).

To change the initial codes or re-apply schema changes, edit and re-run
`supabase/setup.sql` in the Supabase SQL Editor — every statement is
idempotent and safe to re-run.

## Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
app (injecting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the
repository's Actions secrets) and publishes `dist/` to GitHub Pages.
