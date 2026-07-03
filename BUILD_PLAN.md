# OxRound — Consolidated Feature Inventory & Execution Plan

> Compiled 2026-07-02 from every file in this folder: README, ARCHITECTURE, ROADMAP, DECISIONS, BUDGET, ONBOARDING, MAINTENANCE, logs.md, archive/CRITIQUE_AND_PLAN.md, archive/OxRound Early Investor Brief.pdf, archive/gemini_ideas_june.pdf.
> Goal: a functional app to show G1 Boxing (first customer). Strategy chosen: **demo slice first** — the 4 must-haves end-to-end on real infrastructure, then layer the rest of Phase 1.

---

## Part 1 — Complete Feature Inventory (every feature mentioned, with source)

### A. The 4 non-negotiable must-haves (logs.md)

| # | Feature | Source | Status in docs |
|---|---|---|---|
| A1 | **Scan to enter** — unique QR per member, scanned at kiosk | logs.md, ARCHITECTURE §6, ROADMAP P1 | Designed; security fixes required (D-01, D-02) |
| A2 | **Logs** — attendance records ("scanned 3pm Wednesdays") | logs.md, ARCHITECTURE §4.4 | Table designed; dashboard views NOT scoped (critique §1.1) — must show member history, streaks, gym-level trends |
| A3 | **Interconnected** — owner deactivates unpaid membership → QR stops working | logs.md, ARCHITECTURE §12 | Designed; missing deactivation notification flow (critique §1.1) |
| A4 | **Community** — owner posts notes/photos: holidays, closures, fights, events | logs.md, ARCHITECTURE §4.6 | Designed one-directional; critique recommends reactions + read receipts |

Plus from logs.md July 2: **demonstrate user-loss cost with numbers** via dashboards/analytics — the attendance dashboard must surface at-risk members and retention numbers, not just raw logs.

### B. Member App — Phase 1 (ROADMAP, Amir's list in logs.md)

| # | Feature | Details |
|---|---|---|
| B1 | Auth | Login, register, forgot password, join via invite code. Email OTP recommended over magic link on mobile (D-08) |
| B2 | Dashboard | Today's classes, upcoming bookings, membership status, announcements |
| B3 | Class schedule | Browse, filter by coach/type, view available spots |
| B4 | Class booking | Book, cancel, join waitlist. Booking gating = strongest app-adoption lever (ONBOARDING) |
| B5 | QR check-in | Member shows QR full-screen; works with printed QR card fallback |
| B6 | Membership status | Type, renewal date, active/frozen/expired. No payments in app (Phase 2) |
| B7 | Push notifications | Booking confirmed, class cancelled, waitlist opened, announcements |
| B8 | Profile | Name, photo, phone, email, emergency contact, DOB (D-04) |
| B9 | Coach profiles | Photo, bio, classes, experience (Amir's list — "nothing more") |
| B10 | Attendance history (member-facing) | Classes attended, history view |
| B11 | Kiosk mode | Tablet camera scan screen, Guided Access lockdown, gym-scoped kiosk JWT (D-01) |
| B12 | Human-touch onboarding animation | Justin's idea (logs.md): opening-doors animation with photos of the gym owner — warm, Apple-polish feel, owner-first, not generic tech |

### C. CRM (web) — Phase 1 (ROADMAP, Amir's list)

| # | Module | Details |
|---|---|---|
| C1 | Dashboard | Today's classes, today's attendance, active members, expiring memberships, live check-in feed (Realtime), revenue this month (optional) |
| C2 | Member management | Create, edit, suspend, archive (soft-delete only — D-03), search, view attendance/payments/notes, emergency contact, medical notes; boxing fields collected but hidden (D-07) |
| C3 | Coach management | Add/remove, permissions, schedule, profile; coach-who-is-also-member supported (D-06) |
| C4 | Class management | Create/edit/delete, recurring templates → session generation, capacity, waitlist, attendance, coach assignment, cancellation w/ notification to booked members |
| C5 | Membership management | Monthly / annual / drop-in / punch card / family / trials / intro offers (logs.md data-setup list); assign, freeze, renew, expire. Class-cap enforcement CUT from MVP (critique) |
| C6 | Booking management | Booked members, waitlist, remaining spots, late cancellations, no-show handling |
| C7 | Payment tracking (manual) | Paid/pending, cash/e-transfer/card, invoice history, daily "mark payments received" flow (ONBOARDING). No Stripe for members yet |
| C8 | Announcements | Push + in-app post + email blast, photo support, pinned, types (closure/fight/event), read counts |
| C9 | QR check-in dashboard | Live feed, kiosk management, QR rotate (compromised code) |
| C10 | Settings | Gym logo, info, hours, membership types, class colors, cancellation policy |
| C11 | Permissions/roles | Owner, coach, member, trial (ARCHITECTURE); Amir adds manager + receptionist — schema should allow role list |
| C12 | Reports (simple) | Members, attendance, revenue, popular classes, coach attendance, membership renewals |

### D. Infrastructure — must be live for pilot (ROADMAP)

| # | Item | Source |
|---|---|---|
| D1 | Supabase project (prod + staging), RLS on every table | ARCHITECTURE §3, §5 |
| D2 | Auth hook Edge Function → gym_id + role JWT claims | ARCHITECTURE §6 |
| D3 | Edge Functions: check-in, auth-hook, notify-broadcast, membership-expiry (pg_cron), stripe-webhook, qr-rotate | ARCHITECTURE §7 |
| D4 | CI/CD: GitHub Actions (lint → typecheck → test → migration → Vercel deploy → EAS Update) | ARCHITECTURE §10 |
| D5 | Sentry error monitoring, uptime checks | MAINTENANCE |
| D6 | Resend transactional email | ARCHITECTURE §2.4 |
| D7 | Quebec Law 25: privacy policy, "download my data" export, "delete my account" (anonymize, 2-yr hold), privacy officer, 72h breach notification, Supabase DPA signed | MAINTENANCE compliance |
| D8 | Feature flags via gyms.settings jsonb (D-13) | MAINTENANCE |
| D9 | cron_job_log table + stale-job Sentry alert | MAINTENANCE |
| D10 | Image compression for announcement media (<500KB) | critique of BUDGET media estimate |
| D11 | Rate limiting on check-in function (brute-force protection) | critique §11 |
| D12 | i18n scaffolding (react-i18next / i18n-js) from day 1, English-only strings; French before 5th gym (D-12) | DECISIONS, critique |

### E. Onboarding & deployment tooling (ONBOARDING.md, logs.md data-setup list)

| # | Item |
|---|---|
| E1 | CSV import script (Type B gyms): CSV → auth.users + profiles + gym_members + memberships |
| E2 | QR card print sheet (credit-card size, per member) + in-gym QR poster |
| E3 | Onboarding email sequence w/ app-store deep links |
| E4 | Kiosk setup: owner's iPad + Guided Access, ~$30 wall mount; no hardware provided in pilot (D-17) |
| E5 | Discovery questionnaire (14 questions) → onboarding brief |
| E6 | Data cleaning: dedupe, fix invalid emails, decide what not to migrate |
| E7 | Staff training (learnable within a day), go-live support, 2-week parallel running |
| E8 | Waivers: paper for pilot, scanned to Storage at waivers/[gym_id]/[member_id] (D-11) |

### F. Phase 2 (3–6 mo, after 3 paying gyms) — ROADMAP + Amir + logs.md growth layer

Lead/trial Kanban pipeline (+ lead_activities, sources incl. TikTok/Facebook per critique); coach notes (visibility: coaches/owner_only/member_visible per critique); automated follow-up reminders (pg_cron + Resend); attendance analytics dashboard (popular classes, coach performance, member frequency); at-risk member detection from attendance drops; coach invite flow; digital waiver (e-signature, DocuSeal or canvas); CSV export; French i18n; workout plans; skill progression tracking; in-app Stripe payments; event registration; push reminders (class, expiry); referral program; automated email/SMS comms (renewals, waitlist); PostHog analytics; automated membership expiry.

### G. Phase 3 (6–12 mo) — boxing moat + revenue expansion

Grade/rank progression tracking (promotion criteria: classes, hours, attendance, skills — logs.md); pad-work scheduling (1:1 over group classes); fight camp management (sparring frequency, weight cuts, training load); injury notes; weight class/fight record surfaced; website add-on widget (public schedule + trial booking → leads); Stripe Connect gym-to-member payments (margin model unresolved — D-16); advanced reporting (MRR, churn, LTV); staff payroll; multi-location; LLM owner co-pilot (text-to-SQL); training library; community feed; cross-gym memberships; gym discovery; POS/retail; access control/door integration (logs.md ops list); Instagram ingestion.

### H. Future vision (post-Series A — do not plan)

AI coach (computer vision punch analytics), predictive churn & injury modeling (XGBoost), autonomous 24/7 lead conversion agent (Instagram/SMS), tournaments, marketplace, wearables, nutrition.

---

## Part 2 — Blocking decisions resolved for this build

These DECISIONS.md items are resolved by taking the recommended option and baking them into the first migration/code (to be moved to "Resolved" in DECISIONS.md):

| ID | Resolution applied |
|---|---|
| D-01 | Kiosk uses gym-scoped JWT (custom signing in Edge Function) with insert-only access to check_ins. Service role never leaves server. |
| D-02 | Check-in tokens hashed with SHA-256, not bcrypt. Column named `check_in_token_hash`. |
| D-03 | No `FOR ALL` RLS policies. Owner gets SELECT/INSERT/UPDATE; DELETE blocked everywhere. Archive = `status='archived'`. |
| D-04 | `profiles.date_of_birth date` in initial migration. |
| D-05 | `payment_status` default `'pending'`. |
| D-06 | `gym_members.roles text[] NOT NULL DEFAULT '{member}'` (option a). |
| D-07 | `weight_class`, `skill_level`, `fight_record jsonb`, `medical_notes` added now, hidden in UI. |
| D-08 | Email OTP for member app; magic link stays for CRM web. |
| D-10 | Offline kiosk fallback = manual attendance in CRM (option c) for pilot. |
| D-13 | Feature flags in `gyms.settings` jsonb. |

Still needs founder input (does not block the demo slice): D-09 (multi-gym coach), D-14/D-15 (budget doc revisions), D-16 (payments margin model), D-17 (confirm G1 owner has an iPad + reliable WiFi — ask at next meeting).

---

## Part 3 — Execution Plan

### Stage 0 — Foundation (this week)

1. Scaffold pnpm monorepo: `apps/web` (Next.js 14 + TS + Tailwind + shadcn/ui), `apps/mobile` (Expo + TS + NativeWind), `packages/db` (generated types), `supabase/` (config, migrations, functions). Skip Turborepo for now (critique: premature at 2 apps).
2. Initial migration: full ARCHITECTURE §4 schema with Part 2 fixes + `announcement_reads`, `announcement_reactions`, `attended` booking status, `check_ins.method` enum `qr_kiosk|qr_phone|manual_staff|manual_import`, `cron_job_log`.
3. RLS policies on every table (soft-delete pattern).
4. Auth: Supabase Auth + auth-hook Edge Function injecting `gym_id` + `roles`.
5. Seed script: G1 Boxing gym + demo members/classes for the demo.

### Stage 1 — Demo slice (weeks 1–3): the 4 must-haves, showable to G1

**A3 Interconnected (build first — it's the CRM core):**
- CRM member list: search, filter by status/plan/payment; member profile page.
- Create/edit member → auto-generates check-in token + QR.
- Membership assign + payment status toggle (paid/pending/cash/e-transfer/card).
- Deactivate flow: archive membership → QR invalidated at check-in → notification queued to member (fixes critique gap).

**A1 Scan to enter:**
- `check-in` Edge Function: SHA-256 token lookup, active-status check, 1h duplicate window, rate limit; returns member name + membership status.
- Kiosk screen (Expo, `expo-camera` with `onBarcodeScanned` — not deprecated barcode-scanner package).
- Member QR display screen (works before full app: QR card print sheet from CRM as fallback — E2).
- Gym-scoped kiosk JWT provisioning from CRM settings.

**A2 Logs + numbers:**
- CRM live check-in feed (Supabase Realtime).
- Member attendance history: last 30 days, streak, total visits.
- Gym overview: busiest days/times, weekly trend, and the user-loss view — members whose attendance dropped vs. prior month (the "show churn cost in numbers" demo moment from logs.md).

**A4 Community:**
- CRM: create announcement (title, body, photos w/ client-side compression, type, pinned, expiry).
- Member feed (web view first if mobile app isn't ready for the demo; Expo screen next).
- Reactions (single tap-like) + read counts ("42 of 80 members saw this").
- Push broadcast via `notify-broadcast` (Expo Push) once mobile app exists; email blast via Resend meanwhile.
- B12 human-touch opening animation on member app splash (owner photos, doors opening) — small, high demo impact.

**Demo day checklist:** seeded G1 data → owner logs in → adds a member → prints/shows QR → kiosk scan succeeds → feed updates live → mark member unpaid → deactivate → scan fails with clear message → post "gym closed Friday" announcement with photo → member view shows it.

### Stage 2 — Complete Phase 1 MVP (weeks 4–12)

Order chosen so each ship is independently demoable:
1. Classes: templates → session generation (pg_cron weekly), schedule views (CRM + app), cancellation w/ member notification.
2. Booking: book/cancel/waitlist, capacity enforcement in Edge Function, no-show auto-mark after session (pg_cron), `attended` reconciliation on check-in.
3. Member app full build: auth (email OTP), dashboard, schedule, booking, QR tab, profile, announcements, push tokens; TestFlight distribution.
4. Coach management + coach profiles + roles/permissions.
5. Payment tracking UI: invoice history + daily "mark payments received" flow.
6. Settings module + reports (simple counts) + CSV import script (E1) for G1 data entry.
7. Infra hardening: CI/CD pipeline, Sentry, uptime checks, staging env, Law 25 privacy policy + data export/delete flows.

### Stage 3 — G1 go-live (per ONBOARDING.md)

Discovery questionnaire → data entry session with owner (Type A/B playbook) → QR card sheet printed → kiosk iPad configured (Guided Access) → app day activation session → 2-week parallel run with WhatsApp/paper → weekly check-ins, support via email/WhatsApp.

### Deferred (explicit — do not scope-creep)

Everything in Part 1 sections F–H, plus: Stripe member payments, digital waiver, lead pipeline, coach notes, CSV export UI, French, multi-gym, class-cap enforcement, POS, door access.

---

## Part 4 — Cross-document corrections to make

1. ARCHITECTURE §10: Stripe fee "0.5%" → 2.9% + $0.30; EAS Production "$99" → $199 (BUDGET.md is correct).
2. BUDGET.md 12-month projection (50 gyms) → align to investor brief's 10-gym target (D-14); add churn (2–5%/mo) + CAC (~$600–675) rows (D-15).
3. ARCHITECTURE §9: remove "service role token" kiosk language once D-01 fix is implemented.
4. Rename `qr_code` → `check_in_token_hash` in schema docs.
5. Move resolved decisions in DECISIONS.md to the Resolved table.
