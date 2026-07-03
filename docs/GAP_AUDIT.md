# OxRound — Complete Gap Audit

> Written 2026-07-03 after re-reviewing every document and the codebase. Answers: "is DEPLOY.md everything?"
> **No.** DEPLOY.md gets the demo-slice CRM live and the minimum member app shipped. Below is everything else, exhaustively, in four buckets: ✅ built · 🔧 covered by DEPLOY.md · ⬜ specced but not yet built · 💡 mentioned in docs but never scoped anywhere.

---

## 1. ✅ Built and verified (demo slice)

CRM dashboard (stats, live check-in feed, at-risk alert) · member list/search/create · member profile (payment status toggle, deactivate/reactivate, QR display, attendance history, manual check-in) · attendance dashboard (busiest days, per-member trends, revenue-at-risk) · announcements (create, types, pin, read/reaction counts displayed) · full DB schema + RLS (D-02→D-07 fixes) · check-in + auth-hook Edge Functions (written, not deployed) · seed data · migration validator · static-export demo build (`demo-static/`, zip in outputs).

## 2. 🔧 Covered by DEPLOY.md (config + 2 build items)

Supabase provisioning (ca-central-1, DPA), functions deploy + auth hook config, storage buckets, **CRM login/auth (build item)**, **print-QR-once dialog (build item)**, Vercel/host + domain, owner account, Sentry/uptime, privacy policy page, G1 data entry, Expo scaffold + 5 screens + push + kiosk + TestFlight, classes/booking backend (listed as C1/C2 prerequisites), CI, backup restore test, support channel.

## 3. ⬜ Specced in the docs, NOT built, NOT itemized in DEPLOY.md

### CRM modules (Phase 1 scope from ROADMAP/Amir's list)
1. **Class management UI** — create/edit/delete, recurring templates, session generation (pg_cron), capacity, coach assignment, class colors, cancellation **with notification to booked members** (critique flagged this gap explicitly).
2. **Booking management UI** — booked members per session, waitlist handling, remaining spots, late cancellations, no-show auto-mark (pg_cron) + `attended` reconciliation on check-in.
3. **Coach management** — add/remove coach, permissions, coach schedule, coach profile (photo/bio/experience → feeds member-app coach profiles).
4. **Membership plans UI** — plans CRUD (schema/seed only today), assign/freeze/renew/expire flows, drop-in and punch-card handling, family memberships (enum exists, zero logic), intro offers.
5. **Payments module** — invoice history view, record-payment form (the `payments` table is entirely unused by the UI), and ONBOARDING's daily **"mark payments received today"** e-transfer flow.
6. **Settings module** — gym logo/info/hours, membership types, class colors, cancellation policy, kiosk management + QR-rotate (the `qr-rotate` Edge Function from ARCHITECTURE §7 is not written).
7. **Reports** — members, attendance, revenue, popular classes, coach attendance, membership renewals (Amir's "simple reports").
8. **Member edit** — profile editing, emergency contact / DOB / boxing-fields capture forms (columns exist, no inputs), archive UI.
9. **Roles enforcement in UI** — manager/receptionist access levels (schema supports, UI doesn't differentiate).
10. **Bulk QR card print sheet** (E2) — single-member QR renders; the credit-card-sized batch sheet for launch week doesn't exist.
11. **Announcement plumbing** — image upload + client-side compression (BUDGET critique), email blast fallback, expiry/auto-archive job, and *writing* `announcement_reads`/reactions (tables exist; nothing populates them — counts shown are demo values).
12. **Deactivation notification** — critique: member must be told their QR stopped working, not discover it at the door; `membership_deactivated` notification type exists, nothing enqueues it.

### Infrastructure / Edge Functions
13. `notify-broadcast` (push fan-out) — not written.
14. `membership-expiry` pg_cron job + `cron_job_log` alerting — not written.
15. `stripe-webhook` (OxRound's own billing) — Phase 2, not written.
16. Durable rate limiting on check-in — current limiter is an in-memory Map, resets per cold start; move to a Postgres counter.
17. Realtime publication config — `check_ins` must be added to `supabase_realtime` publication or the live feed silently stays empty in prod.
18. Feature-flag reads from `gyms.settings` (D-13 resolved on paper, no code reads it).
19. i18n scaffolding (react-i18next / i18n-js, D-12) — decided, not scaffolded; French before 5th gym.
20. Staging environment (second Supabase project) — ROADMAP infra list.

### Onboarding tooling (ONBOARDING.md)
21. CSV import script (E1, Type B gyms) — spec exists, script doesn't.
22. Onboarding email sequence with store deep links (E3).
23. Waiver scan-and-upload flow to `waivers/[gym_id]/[member_id]` (E8) — bucket convention defined, no UI.
24. Discovery questionnaire as a fillable form/brief template.

### Compliance & maintenance (MAINTENANCE.md)
25. "Download my data" export (Law 25) — DEPLOY allows manual-by-email at pilot; the feature is still owed.
26. "Delete my account" anonymization flow (2-year hold logic).
27. Breach-notification procedure written into incident plan (72-hour requirement).
28. RUNBOOK.md, INCIDENTS.md, CHANGELOG.md, per-function READMEs, Loom walkthroughs (key-person-risk mitigations — none exist).
29. In-app 3-question feedback survey post-release.
30. Renovate/Dependabot config + weekly `pnpm audit` in CI.

### Member app (all of BUILD_PLAN §B beyond DEPLOY's 5-screen minimum)
31. Join-via-invite-code flow · 32. Coach profiles screen · 33. Member-facing attendance history · 34. Waitlist join/notify · 35. Offline schedule cache + graceful offline states (regression checklist #10) · 36. Push opt-out handling · 37. Doors-opening owner-photo splash animation (B12 — Justin's concept, planned, unbuilt).

## 4. 💡 In the docs but never scoped into any plan (decide: adopt, defer, or drop)

From **logs.md July 2 notes**:
1. **Precision themes** — per-owner CRM theming ("gemini/claude/chatgpt people", Apple vs Notion taste; "do we make it boxing-themed?"). Product decision + theming architecture (`gyms.settings` can hold a theme key — schema-ready, zero design work done).
2. **Owner photoshoot onboarding** — professional shoot powering the owner's theme/splash; ties to the $299 done-for-you onboarding add-on. Unscoped, unpriced.
3. **Open-source CRM mining** — "adapt the best open-source CRM features/code for boxing." Nobody has actually surveyed open-source gym CRMs. Cheap research task, could shortcut classes/booking UI patterns.
4. **GTM contacts** — Abel, Demetre, the gym next to Circulus (via Dave), Eli for marketing integration. Business actions, tracked nowhere.
5. **reddit_fitness_crm_research.md** — one saved thread (r/gymowner "what CRM are you using"), research not performed.
6. **No-show fees** — in logs.md's data-setup list; **not in the schema** (class_bookings has no fee field), not in any phase. Needs a decision (most boxing gyms don't charge them — confirm with G1).

From **ROADMAP/archive** (listed for phase but worth restating as unscoped-in-detail):
7. Boxing rank/level progression criteria (classes/hours/attendance/skills-based) — Phase 3 headline; COMPETITORS.md recommends pulling a minimal version into Phase 2 (Zen Planner ships belt tracking in core).
8. Access control / door integration (logs.md ops list, Phase 3).
9. POS/retail for gear/supplements (logs.md ops list, Phase 3).
10. Staff training materials ("core functions learnable within a day" benchmark) — no materials exist.
11. Monthly owner ops-review ritual (renewal rate, attendance trends) — process, unowned.
12. Website add-on widget, Stripe Connect payments, advanced reporting, multi-location, LLM co-pilot, AI features — Phase 3/4, correctly deferred, listed for completeness.

### Still-open decisions (DECISIONS.md)
D-01 kiosk JWT **minting flow** (pattern done, minting unbuilt — blocks kiosk hardware), D-09 multi-gym coach, D-14/D-15 BUDGET revisions, D-16 payments margin model, D-17 confirm G1 iPad + WiFi (also resolves D-10's fallback choice).

---

## Recommended sequencing of the above

- **Fold into the production push (weeks 1–2):** items 12, 16, 17 (correctness/safety) + DEPLOY.md as written.
- **Weeks 3–8 (completes Phase 1):** items 1–11, 13–14, 21, 31–37.
- **Before 5th gym:** 19 (French), 22–24, 25–27.
- **Decide this week (cheap, high leverage):** 💡3 (open-source survey), 💡6 (ask G1 about no-show fees), D-17 (ask G1 about iPad/WiFi), 💡4 (log GTM contacts somewhere real).
- **Consciously parked:** 💡7–12, Phase 2+ lists.
