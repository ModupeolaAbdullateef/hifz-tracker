# Hifdh Portal

A mobile-first web portal that replaces the Brothers and Sisters Excel record
sheets for the Hifdh class. Teachers record the whole class from a phone,
students see their own up-to-date record from a personal link, and every
Excel rule (carry-over, status, colours, juz tests, attendance) runs
automatically.

Built with Vite + React + TypeScript and Supabase (Postgres + RPC functions),
hosted on GitHub Pages via GitHub Actions. The specification is
“Hifdh Portal - User Stories for the Developer”.

## Roles

| Role | How they log in | What they see |
| --- | --- | --- |
| Admin | Admin code, then pick or type their name and initials | Both groups, every page |
| Teacher | Their group's code (Brothers or Sisters), then pick their name | Their own group only |
| Student | Personal link + 4-digit PIN | Only their own record and their partner's name |

Staff stay logged in on a device for 12 hours.

## For teachers

- **Record**: today's week opens by default. Tap a name to open their lines,
  then tap **Y**, **N** or **Absent**, or type a number for part done. **Absent**
  next to the name marks every line Absent in one tap. Your initials go on each
  result automatically; change them in the Initials box if someone else tested.
  Results save straight away and, with no signal, are queued and sent when
  you're back online (the “waiting to sync” badge shows how many).
- **Overview**: one row per student with weeks 1–10, Total memorised, Expected
  by now, Total projected, Status, Weeks absent and Attendance. Tap a name to
  see their lines. **Print** gives a one-page copy with name lines only.
- **This week**: Behind, Absent, Revision not done, Juz tests due, Test results.
- **Student page**: type targets for each week, fill a whole line at once,
  type over the gold “Revise this week” suggestion (or reset it), and add
  dated notes. Enter a juz only in the week it changes. Write “Juz 29 Test”
  in a week to schedule a test, then mark Pass, Fail or Redo.
- **Reminders**: each student's targets for the week, ready to send on WhatsApp.

## For the admin

- **Import**: upload “Record sheets - Brothers.xlsx” / “Sisters.xlsx”. The
  preview shows counts, unreadable rows, and any student whose portal totals
  differ from Excel's own (columns P–V) before anything is saved.
- **Terms**: create a 10-week term (optionally copying every student's lines
  from the last term), move or cancel a week, move old terms to history.
- **Students**: add (with line templates), rename (the link stays the same),
  mark as left (removed from pairs, record kept), archive, new PIN, export or
  permanently delete a student's data (UK GDPR).
- **Registration**: who's registered this term and who has paid.
- **Partners**: pairs or threes; duplicates are shown in red; printable cards.
- **Teachers**, **Codes**, **Audit** (every change, with undo), **Export**
  (Excel, or PDF via Print), plus Tips, Docs and Enquiries.

## The rules

All of section 7 lives in `src/hifdh/rules.ts`, with automated tests in
`src/hifdh/rules.test.ts` (`npm test`). The deploy runs the tests first and
stops if any fail.

## Setup

1. In the Supabase SQL editor, run `supabase/setup.sql`, then
   `supabase/hifdh.sql`. Both are safe to run again.
2. If this is a brand-new database, set the first codes once (see the bottom
   of `setup.sql`). Both groups start with the existing teacher code; give each
   group its own on the **Codes** page.
3. Copy `.env.example` to `.env` with the Supabase URL and anon key.
4. `npm install`, then `npm run dev`. `npm test` runs the rule tests.

Deploys happen automatically on every push to `main` (the `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` repository secrets must be set).

## Security

- Row Level Security is on for every table with no policies, so the public key
  can't read tables directly. Everything goes through `SECURITY DEFINER`
  functions that check a staff session (and its group) or a student's link and
  PIN.
- Internal helper functions are explicitly locked so they can't be called with
  the public key.
- Failed codes and PINs are rate-limited.
