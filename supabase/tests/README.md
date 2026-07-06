# Backend tests

These tests exercise the **real security model** the way a logged-in person hits it, so
"works in the demo but breaks against the real database" bugs get caught here instead of
in the app. They are the fix for the whack-a-mole pattern: every write path is asserted,
for every role, in one automated run.

## Run

```bash
supabase test db
```

This spins up the local database, installs pgTAP, and runs every `*.sql` file in this
folder inside a transaction that is **rolled back** — no real data is touched, and no real
accounts are needed (each test builds a throwaway gym + members as fixtures).

To run against a specific local stack: `supabase start` first, then `supabase test db`.

## What's covered

`rls_workflows.test.sql` fakes a logged-in user (the same way the API does — a role +
JWT claims) and asserts:

- **Owner** can run every core workflow: add/edit members, memberships, plans, classes,
  bookings, check-ins, payments, leads, announcements.
- **Member** is denied every staff action (add members, record payments, post
  announcements, create classes) and sees **zero** rows of the roster or payments.

## Adding a test when you build a feature

When you add a new table or a new write in `apps/web/src/lib/data.ts`, add a matching
line here:

- allowed action → `select lives_ok($$ <the insert/update> $$, 'who can do what');`
- forbidden action → `select throws_ok($$ <the insert/update> $$, '42501', null, 'who cannot');`

Bump the number in `select plan(N);` to match the number of `select` assertions.

> Why this exists: the app's data layer runs in demo mode (in-memory) until deployed, so
> the real Postgres/RLS path isn't exercised by clicking around. These tests exercise it
> directly, which is where the real bugs live.
