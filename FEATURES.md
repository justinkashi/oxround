# OxRound — Master Feature List

> THE single source of truth for every feature. Merged from your draft + every repo document (BUILD_PLAN, GAP_AUDIT, ROADMAP, logs.md, Amir's list, ONBOARDING, MAINTENANCE, archive PDFs, COMPETITORS).
> Status: ✅ built in localhost demo · ⬜ not built. Items marked **[added]** were missing from the draft.

---

## Phase 1 — MVP (Core CRM & App)

### CRM (Owner/Admin Web Dashboard)

- ⬜ **Authentication:** magic link login, join-via-invite-code, logout, session guard.
- ✅/⬜ **Dashboard:** today's classes, attendance, active members, expiring memberships. ✅ **Live check-in feed (realtime)** and **at-risk member alert** already built. **[added: live feed + at-risk were missing from draft]**
- ✅/⬜ **Member Management:** ✅ list/search/create/deactivate. ⬜ profile editing, emergency contacts, DOB, medical notes, boxing fields (weight class, skill level, fight record), coach notes, waiver upload, bulk QR card print sheet, **archive = soft-delete only (never hard delete)** **[added]**, **bulk actions** **[added]**, **trial role (walk-in, no booking)** **[added]**.
- ✅/⬜ **Attendance Analytics ("Logs" — core must-have):** ✅ busiest days, per-member trends/streaks, drop-off detection, revenue-at-risk number. ⬜ per-class attendance view. **[added — entire section was missing from draft]**
- ⬜ **Class Scheduling:** schedule grid, create/edit/delete, recurring days, capacity limits, coach assignment, class colors, cancel-session flow **+ auto-notification to booked members on cancellation** **[added]**.
- ⬜ **Booking Management:** per-session rosters, waitlist automation, spots remaining, late-cancel marking, no-show logging, **no-show fees — automated penalty logic for booked members who don't attend (logs.md — needs G1 decision on whether they charge them at all)** **[added]**, **`attended` reconciliation when a booked member checks in** **[added]**.
- ⬜ **Coach Management:** add/remove staff, profiles (photo/bio/experience), role permissions (owner/manager/coach/receptionist), coach scheduling, **coach invite flow (email → role)** **[added]**.
- ⬜ **Membership Plans:** monthly, annual, drop-in, punch-card, family, trial, intro-offer; assign/freeze/renew/expire.
- ✅/⬜ **Manual Payments:** ✅ payment status per member. ⬜ record payments (cash/e-transfer/card), invoice history, daily "mark payments received" flow.
- ✅/⬜ **Communication:** ✅ announcements with types (closure/fight/event), pinning, read counts, reactions. ⬜ image uploads (+compression), **announcement expiry/auto-archive** **[added]**, **email blast to members** **[added]**, deactivation notification (member is told their QR stopped working — never surprised at the door).
- ⬜ **Settings & Customization:** gym logo, business info, operating hours, cancellation policies, kiosk management (QR rotation + kiosk JWT minting), **feature flags per gym** **[added]**.
- ⬜ **Reports:** revenue, popular classes, coach attendance, renewals, member counts, CSV exports, **birthday reminders (Amir nice-to-have)** **[added]**.
- ✅/⬜ **Operational Back-ups:** ✅ manual check-in override. ⬜ Type-B CSV import wizard, Law 25 tools (data download, PII anonymization).

### QR Check-In System (the #1 must-have — its own section) **[added: draft had only the kiosk screen]**

- ✅ Unique QR per member; deactivated membership ⇒ scan rejected ("interconnected").
- ⬜ Secure token flow (SHA-256, shown/printed once), duplicate-scan window (1 h), brute-force rate limiting, kiosk offline fallback (manual mode), first-scan "Welcome to OxRound" moment, in-gym QR poster.

### Member App & Kiosk (Mobile/Tablet)

- ⬜ **Splash & Login:** doors-opening owner-photo splash, welcome flow, email OTP login.
- ⬜ **Home:** today's classes, upcoming bookings, membership status, announcements feed with reactions.
- ⬜ **Class Schedule:** browse, filter by coach/type, spots left, book/cancel/waitlist.
- ⬜ **My QR:** full-screen check-in code.
- ⬜ **Profile:** membership status, renewal date, attendance history, emergency contact.
- ⬜ **Staff Directory:** coach profiles.
- ⬜ **Kiosk Screen:** locked tablet camera view, dynamic states ("Welcome, Marco ✓" / "Membership inactive ✗").
- ⬜ **Push Notifications:** booking confirmed, class cancelled, waitlist opened, announcements — **+ in-app notification feed as fallback when push fails** **[added]**, **push opt-out handled gracefully** **[added]**, **offline mode: cached schedule + graceful errors** **[added]**.

### Infrastructure & Compliance (Phase 1, invisible but required) **[added — section missing from draft]**

- ⬜ Notification queue with retry · membership-expiry cron + silent-failure alerting · CI/CD pipeline · staging environment · error monitoring · uptime checks · verified backups · privacy policy + 72 h breach procedure + Supabase DPA (Law 25) · i18n scaffolding day 1 (strings English-only) · onboarding email sequence with app-store deep links · "app day" activation playbook.

---

## Phase 2 — Growth & Retention

- ⬜ Lead/Trial Kanban pipeline (New → Contacted → Trial → Converted/Lost), activity logs, follow-up reminders, **lead source tracking incl. TikTok/FB + who-captured attribution** **[added]**.
- ⬜ Digital waivers (e-signature + storage).
- ⬜ Automated drip campaigns (SMS/email trial nurture, "we miss you" retention).
- ⬜ In-app payments (member self-service, Stripe) — **blocked by D-16 margin-model decision** **[added]**.
- ⬜ Member progression: boxing rank/level tracker (promotion criteria: classes/hours/skills). *(Docs had this Phase 3; COMPETITORS.md supports pulling it here — Zen Planner ships belt tracking in core.)*
- ⬜ Workout plans / training assignments · **personal-training session bookings (Amir P2)** **[added]**.
- ⬜ Advanced analytics: MRR, churn, LTV.
- ⬜ Marketing: referral program, event registration, website add-on widget (public schedule + trial booking → leads).
- ⬜ Localization: full French toggle (before 5th gym).
- ⬜ **Coach notes with member-visible option (technique feedback in the member's app)** **[added]** · **Google/Apple social login** **[added]** · **push reminders (class in 1 h, membership expiring)** **[added]** · **automated membership expiry** **[added]** · **product analytics instrumentation** **[added]** · **in-app 3-question feedback survey to owners** **[added]** · **kiosk offline token cache (if G1 reports WiFi issues)** **[added]**.

---

## Phase 3 — Platform, Combat-Sports Depth & AI

- ⬜ Fight Camp Mode: sparring frequency, weight-cut trajectory, training load per competitor.
- ⬜ Pad-work scheduling: 1:1 overlay booking on open gym/class hours.
- ⬜ Coach/admin expansion: injury notes (coach-visible only), multi-location switcher, staff payroll.
- ⬜ Network effects: training video library, gym discovery, cross-gym memberships.
- ⬜ Precision themes (Apple-clean / Notion-style / boxing-dark) + **"human touch" concierge onboarding: professional photoshoot/headshot (even the haircut) capturing the owner's vibe, injected into their CRM theme and the doors-opening splash ($299 add-on candidate)** **[added]**.
- ⬜ LLM Co-Pilot (natural-language owner queries).
- ⬜ Autonomous lead agent (Instagram DMs + widget + SMS, 24/7).
- ⬜ Predictive churn modeling (ML risk scores) · computer-vision fight-form analytics (punch volume/velocity/fatigue).
- ⬜ **White-label branded member app (Growth tier — Exercise.com charges a premium for exactly this)** **[added]** · **Stripe Connect gym-to-member payments with flat published markup** **[added]** · **Instagram post ingestion as announcements** **[added]** · **dedicated kiosk hardware program ($299 setup add-on)** **[added]** · **POS/retail for gear & supplements** **[added]** · **access control / door integration** **[added]** · **community feed (gym-scoped)** **[added]** · **SMS OTP via Twilio for non-email demographics** **[added]**.

---

## Backlog / Vision (post-Series A — parked, from Amir's "NOT MVP" + gemini PDF)

Tournaments management (running/organizing combat-sports tournaments) · challenges & rankings · cross-gym marketplace (multi-gym storefront ecosystem) · merchandise & equipment store · nutrition plans · strength & conditioning library · boxing combinations library · sparring tracker · personal messaging · Apple Health / wearables · AI scheduling · AI boxing coach · MMA/Muay Thai/BJJ modules.

---

## Cross-references

Build order for Phase 1: BUILD_PLAN.md · everything-not-built detail: GAP_AUDIT.md · go-live steps: DEPLOY.md · open decisions blocking features: DECISIONS.md (D-16 payments margin, D-17 kiosk hardware, no-show fees question for G1).
