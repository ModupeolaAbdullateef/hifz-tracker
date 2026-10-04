# Build: Swansea Mosque Hifz Progress Tracker

Build a complete, production-ready web app in this empty folder, then publish it to GitHub Pages. Work through the phases below in order and tell me when you need me to do something manually.

## Context

Swansea Mosque runs a 10-week Hifz (Qur'an memorisation) class. Most students are children. Today teachers fill in an Excel sheet during each class: one block per student, one column per week, and these rows:

| Field | Meaning | Input type |
|---|---|---|
| **New Hifz** | New memorisation that week | number, decimals allowed (e.g. 0.5, 0.03), unit "pages" |
| **Old Hifz** | Recent memorisation recited | number, decimals allowed, unit "pages" |
| **Revision** | Older revision done | Yes / No |
| **Tajweed** | Tajweed covered / done | Yes / No |

In the sheet, a **red** week means the student was **absent** and a **green** week means a **good week**. The app replaces this sheet.

**Course schedule:** classes are **every Thursday**, starting **Thursday 15 October 2026**, for **10 weeks** (week 10 = Thursday 17 December 2026).

- Teachers log in with their name plus a shared class access code. They **search a student by name** and fill in that week's record, or work through the whole class for a week.
- Students/parents look up a record and see the same weekly grid plus their progress.
- An admin (lead teacher) manages students, the course, the record fields, the codes and the tips.

## Tech stack (do not deviate)

- **Vite + React + TypeScript**, plain CSS with CSS custom properties (no UI framework needed).
- **Supabase** (free tier) as the database, via `@supabase/supabase-js`, using only the **anon key** in the browser.
- **HashRouter** (react-router) so page refreshes work on GitHub Pages.
- Hosted on **GitHub Pages**, deployed by a **GitHub Actions** workflow.
- Mobile-first: teachers will mostly use phones in the classroom.

## Security model (critical — read carefully)

GitHub Pages is static and all frontend code is public, so **no secret or code check may happen in the browser**.

1. Enable **Row Level Security on every table** and create **no policies for the anon role**, so the anon key cannot read or write any table directly.
2. All access goes through **Postgres functions marked `SECURITY DEFINER`** (called with `supabase.rpc`), with `EXECUTE` granted to `anon` only on the functions listed below. Set `search_path` explicitly on each function.
3. Store the teacher access code and admin code **hashed** (`pgcrypto` `crypt()` with `gen_salt('bf')`), never in plain text and never in the repo.
4. Teacher/admin login returns a random session token (uuid) stored in an `auth_sessions` table with a role and a 12-hour expiry. The frontend keeps it in `sessionStorage`. Every staff function takes the token as its first argument and validates it (role + not expired) before doing anything.
5. Public name search returns only `id`, first name and last initial — never records. Opening a full record requires the student's **student code** (e.g. `HZ-4821`), validated server-side.
6. Rate-limit failed logins and failed student-code attempts (log attempts in a table; reject after 10 failures in 15 minutes per name/student).
7. Never use or ask for the service_role key.

## Database (write as `supabase/setup.sql`, idempotent so it can be re-run)

Tables (snake_case):
- `course` — single row: name, start_date (`2026-10-15`), weeks (`10`), class_weekday (`4` = Thursday), target_pages (default course target, optional).
- `course_weeks` — week_number (1–10), class_date (computed weekly from start_date), cancelled (bool, for holidays / no class), note.
- `students` — id, first_name, last_name, student_code (unique, `HZ-` + 4 digits), join_week (default 1), target_pages (optional, overrides course target), active, created_at.
- `record_fields` — **data-driven field definitions** so the admin can add or rename fields later: key, label, type (`number` | `yesno`), unit (e.g. "pages"), sort_order, active. Seed with the four fields in the table above (`new_hifz`, `old_hifz`, `revision`, `tajweed`).
- `weekly_records` — one row per student per week, **unique (student_id, week_number)**: status (`present` | `absent`), good_week (bool), values (jsonb keyed by field key, e.g. `{"new_hifz": 0.5, "old_hifz": 1, "revision": true, "tajweed": false}`), note, next_assignment, created_by, updated_by, created_at, updated_at.
- `badges` — student_id, badge_key, awarded_at. Awarded automatically on save: first record, first good week, 3 good weeks, perfect attendance so far, 1 / 5 / 10 pages of New Hifz, target reached.
- `tips` — id, category (`technique` | `schedule` | `announcement`), text, active, sort_order.
- `settings` — teacher_code_hash, admin_code_hash.
- `auth_sessions` — token, role (`teacher` | `admin`), display_name, expires_at.
- `login_attempts` — for rate limiting.

Functions exposed to anon:
- `search_students(q text)` → id, first_name, last_initial (min 2 chars, max 10 results, active students only).
- `get_student_record(student_id uuid, code text)` → JSON with student, course + weeks, fields, all weekly records, totals and badges. Fail on wrong code.
- `get_active_tips()`.
- `staff_login(display_name text, code text)` → token + role (check admin code first, then teacher code).
- `staff_logout(token)`.
- Teacher (token-checked): `staff_search_students(q)` (full names), `get_student_grid(student_id)`, `save_weekly_record(student_id, week_number, status, good_week, values jsonb, note, next_assignment)` (upsert; validate values against `record_fields` types), `get_week_roster(week_number)` (every active student with their record for that week, if any), `get_class_overview()`.
- Admin only: `upsert_student`, `deactivate_student`, `regenerate_student_code`, `update_course` (recomputes week dates), `set_week_cancelled`, `upsert_record_field`, `upsert_tip`, `delete_tip`, `set_codes(new_teacher_code, new_admin_code)`, `export_class` (JSON for CSV export, one row per student per week, one column per field).

At the bottom of `setup.sql`, include a clearly marked snippet I edit and run once in the SQL editor to set the initial codes (the function must **not** be granted to anon):
```sql
-- EDIT THESE, then run once:
select set_initial_codes('CHANGE-ME-TEACHER', 'CHANGE-ME-ADMIN');
```

Seed `course`, `course_weeks`, `record_fields` and `tips`.

## The weekly grid (core UI — used by both teachers and students)

A grid that mirrors the Excel sheet:
- Columns = weeks 1–10, each header showing the week number and the Thursday date (UK format, e.g. 15/10/2026).
- Rows = the active record fields (New Hifz, Old Hifz, Revision, Tajweed).
- Cell colours: **absent week = red column**, **good week = green column**, recorded = white, cancelled week = grey with "No class", future week = light grey, weeks before the student's join_week = muted with "Not joined".
- Current week (the most recent Thursday on or before today, Europe/London) highlighted with a brand-colour outline.
- On phones, the grid scrolls horizontally with the field labels sticky on the left, and the current week scrolled into view.
- Use the theme tokens for red/green (e.g. `--status-absent`, `--status-good`) so they can be tuned to the brand palette, while keeping red = absent and green = good week clearly recognisable. Also show a small icon or text label, so colour is not the only signal.

## Features

### Teacher side (`/#/staff`)
1. Simple login: name + access code. Clear error on wrong code. Logout button.
2. **Find a student**: search box (as-you-type) → tap a name → their weekly grid opens.
3. **Fill a week**: tap a week column (defaults to the current week) → an edit panel/bottom sheet with:
   - Present / **Absent** toggle (absent hides the field inputs and marks the week red)
   - Inputs for each active field: a number input with step 0.01 and decimal keypad (`inputmode="decimal"`) for number fields; a large Yes/No toggle for yes/no fields
   - **Good week** toggle (marks it green)
   - Note and next assignment
   - Save, plus **Save & next student**
   - Shows who last edited the record and when
4. **Class week view** ("This Thursday"): pick a week (defaults to current) → list of all active students showing done/not done for that week → tap to fill; "Save & next" moves through the list. Show a progress count, e.g. "8 of 12 recorded".
5. **Class overview**: table of students with total New Hifz pages, Old Hifz pages, attendance %, good weeks, last recorded week, and an on-track / behind indicator against target.

### Student side (public)
1. **Tips marquee** across the top of student pages: cycles through active tips with a small category label, shuffled each visit, pauses on hover/tap. If `prefers-reduced-motion` is set, fade tips in one at a time instead of scrolling. Announcements are shown with a distinct accent style.
2. **Find my record**: search by name → pick name (first name + last initial) → enter student code → record opens. Remember the opened student in `sessionStorage` only.
3. **Progress page**:
   - Read-only weekly grid (as above).
   - Progress ring: total New Hifz pages vs target (hide if there is no target).
   - Stat cards: New Hifz total, Old Hifz total, attendance (e.g. 5/6 weeks), good weeks.
   - A small bar chart of New Hifz per week (lightweight: plain SVG or a tiny library).
   - Latest teacher note and **next assignment**, shown prominently.
   - Badges earned.
   - **Certificate** button, enabled after week 10 or when the target is reached: a print-friendly certificate page (`window.print()` with a print stylesheet).

### Admin side (same login; admin code unlocks extra tabs)
- Manage students: add, edit, set join week and target, deactivate, regenerate code, show code to hand to the parent.
- Course: start date, number of weeks, mark weeks cancelled.
- Record fields: rename, reorder, add (number or yes/no), deactivate. Existing data is never deleted.
- Tips: add/edit/delete/reorder, category, active toggle.
- Change teacher and admin codes.
- Export the class as CSV (one row per student per week).

## Design

- Use **Swansea Mosque's colours**. Define ALL colours as CSS custom properties in one file (`src/styles/theme.css`) so they can be swapped in one place. If I paste their logo or a screenshot into the chat, match it. Until then, use these placeholders, marked `/* PLACEHOLDER: replace with Swansea Mosque brand colours */`:
  - `--brand-primary: #0F5132` (deep green), `--brand-secondary: #C9A227` (gold), `--brand-ink: #1B1B1B`, `--brand-surface: #FBF8F1` (warm off-white), `--status-absent: #D93A3A`, `--status-good: #7CC24E`.
- Calm, dignified and welcoming: generous spacing, rounded cards, a subtle Islamic geometric pattern (pure CSS/SVG, no images of people) in the header.
- Fonts from Google Fonts: a clean sans for UI and **Amiri** (or similar) for Arabic text.
- Headings bilingual English/Welsh where natural (e.g. "My Progress / Fy Nghynnydd"; the mosque's Welsh name is "Mosg Abertawe").
- Accessible: WCAG AA contrast, keyboard navigable, visible focus, labelled inputs.
- Friendly loading and empty states (e.g. "No weeks recorded yet — your journey starts on Thursday 15 October, in sha Allah").

## Starter tips (seed data)

Technique:
- Listen to your new ayaat recited by a qari several times before you start memorising.
- Repeat each ayah 10–20 times looking, then 10–20 times without looking, before moving on.
- Join the ayaat together: recite ayah 1+2, then 1+2+3, building up the passage.
- Always use the same mushaf so your mind remembers where each ayah sits on the page.
- Recite your new portion in your sunnah and nafl prayers.
- Understand the meaning of what you memorise — it makes the words stick.

Schedule:
- Memorise your new hifz after Fajr, when your mind is fresh.
- Every day has three parts: new hifz, old hifz and revision. Never skip revision.
- Little and often beats a lot once a week. Try 20 focused minutes every day.
- Recite your new hifz to a family member before Thursday's class.
- Revise before you sleep, and test yourself again in the morning.
- Pick a fixed time and place each day for your hifz so it becomes a habit.

## Configuration

- Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment variables. Provide `.env.example`; add `.env` to `.gitignore`.
- In `vite.config.ts`, set `base` to `/<repo-name>/` (use the repo name you create below).
- Do all date logic in the Europe/London time zone.

## Phases

1. **Scaffold** the project and build all features above. Write `supabase/setup.sql`.
2. **Stop and tell me** to: create the Supabase project (if not done), run `setup.sql` in the Supabase SQL Editor, run the initial-codes snippet, and put my URL and anon key in `.env`. Wait for me to confirm.
3. **Test locally** with `npm run dev`: walk me through adding two students, logging in as a teacher, searching a student, filling a week (one present with values, one absent, one good week), and viewing the grid as the student. Fix any issues. Also confirm that querying a table directly with the anon key is denied.
4. **Publish**:
   - `git init`, commit, then create a **public** GitHub repo called `hifz-tracker` (use the GitHub CLI or your GitHub access) and push.
   - Add `.github/workflows/deploy.yml` that builds with Node 20 on push to `main`, injects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from repository Actions secrets, and deploys with `actions/upload-pages-artifact` + `actions/deploy-pages`.
   - Try to set the repo secrets and enable Pages with source "GitHub Actions" (e.g. `gh secret set`, `gh api -X POST repos/{owner}/{repo}/pages -f build_type=workflow`). If you can't, tell me exactly which settings to click.
   - Give me the live URL once the workflow succeeds.
5. Write a short `README.md` for the mosque: how teachers log in and fill a week, how admins add students, fields and tips, how to change codes and colours.

Ask me before making any assumption that changes the data model or security model.
