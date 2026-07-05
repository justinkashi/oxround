# OxRound — Master Feature List

> THE single source of truth for every feature. Merged from your draft + every repo document (BUILD_PLAN, GAP_AUDIT, ROADMAP, logs.md, Amir's list, ONBOARDING, MAINTENANCE, archive PDFs, COMPETITORS).
> Status: ✅ built in localhost demo · ⬜ not built. Items marked **[added]** were missing from the draft.

---

## Phase 1 — MVP (Core CRM & App)

### CRM (Owner/Admin Web Dashboard)

- ✅/⬜ **Authentication & role routing:** ✅ real magic-link login (invite-only), server-side code exchange, session guard, logout, **one login → role router (owner/manager→CRM, coach/receptionist→restricted CRM, member→/app), member/staff two-way guard, no-access page** (Step 6A/6B). ⬜ join-via-invite-code.
- ✅/⬜ **Dashboard:** today's classes, attendance, active members, expiring memberships. ✅ **Live check-in feed (realtime)** and **at-risk member alert** already built. **[added: live feed + at-risk were missing from draft]**
- ✅/⬜ **Member Management:** ✅ list/search/create/deactivate. ⬜ profile editing, emergency contacts, DOB, medical notes, boxing fields (weight class, skill level, fight record), coach notes, waiver upload, bulk QR card print sheet, **archive = soft-delete only (never hard delete)** **[added]**, **bulk actions** **[added]**, **trial role (walk-in, no booking)** **[added]**, **onboarding lifecycle: add ⇒ Invited (email activation link) ⇒ Joined-unpaid (app access, QR blocked) ⇒ Active on payment confirmation (D-24)** **[added]**.
- ✅/⬜ **Attendance Analytics ("Logs" — core must-have):** ✅ busiest days, per-member trends/streaks, drop-off detection, revenue-at-risk number. ⬜ per-class attendance view. **[added — entire section was missing from draft]**
- ✅/⬜ **Class Scheduling:** ✅ weekly schedule grid, create class, recurring days, capacity limits, coach assignment, class colors, deactivate class, cancel-session flow. ⬜ edit existing class, **auto-notification to booked members on cancellation** **[added]**.
- ✅/⬜ **Booking Management:** ✅ per-session rosters, waitlist (auto-waitlist when full + promote), spots remaining, cancel/no-show/attended marking, book member from CRM. ⬜ **no-show fees — automated penalty logic (needs G1 decision)** **[added]**, **automatic `attended` reconciliation when a booked member checks in** **[added]**.
- ✅/⬜ **Coach Management:** ✅ staff list, promote member to coach, remove coach role, role badges. ⬜ profiles (photo/bio/experience), coach scheduling, **coach invite flow (email → role)** **[added]**, **role-scoped CRM view for coach/receptionist (D-21 — restricted tabs/actions, same app not a separate one)** **[added]**.
- ✅/⬜ **Membership Plans:** ✅ all plan kinds (monthly/annual/drop-in/punch-card/family/trial/intro-offer), create + activate/deactivate. ⬜ assign/freeze/renew/expire per member.
- ✅/⬜ **Manual Payments:** ✅ payment status per member, record payments (cash/e-transfer/card), payment history, daily + monthly totals, recording marks membership paid. ⬜ printable invoices.
- ✅/⬜ **Communication:** ✅ announcements with types (closure/fight/event), pinning, read counts, reactions. ⬜ image uploads (+compression), **announcement expiry/auto-archive** **[added]**, **email blast to members** **[added]**, deactivation notification (member is told their QR stopped working — never surprised at the door).
- ⬜ **Messaging + Community + notifications (D-23):** ⬜ **Community tab** both apps (staff post, members view+react — surfaces the announcements feature); ⬜ **direct messaging** staff↔member (net-new; scope TBD — default two-way 1:1 + broadcast); ⬜ **notification bell** 🔔 in both apps' top bar carrying messages + community + **system notifications** — owner: at-risk/overdue/new-member (derived from analytics); member: upcoming class/cancelled/waitlist/expiring. **[added]**
- ✅/⬜ **Settings & Customization:** ✅ business info, operating hours, cancellation policy. ⬜ gym logo upload, kiosk management (QR rotation + kiosk JWT minting — D-01), **feature flags per gym** **[added]**.
- ✅/⬜ **Reports:** ✅ revenue by month + by method, popular classes, member counts, at-risk count, attendance leaderboard, payments CSV export. ⬜ coach attendance, renewals report, **birthday reminders (Amir nice-to-have)** **[added]**.
- ✅/⬜ **Operational Back-ups:** ✅ manual check-in override. ⬜ Type-B CSV import wizard, Law 25 tools (data download, PII anonymization).

### QR Check-In System (the #1 must-have — its own section) **[added: draft had only the kiosk screen]**

- ✅ Unique QR per member; deactivated membership ⇒ scan rejected ("interconnected").
- ✅/⬜ **Unpaid ⇒ no access (D-20):** ✅ member app hides QR when overdue/inactive; ✅ scanner rejects unpaid/inactive at the door ("Payment due ✗"); ✅ duplicate-scan window (1h). ⬜ grace-period timer + auto-notify (needs G1 grace length).
- ⬜ Secure token flow (SHA-256, shown/printed once), duplicate-scan window (1 h), brute-force rate limiting, kiosk offline fallback (manual mode), first-scan "Welcome to OxRound" moment, in-gym QR poster.

### Member App & Kiosk (Mobile/Tablet)

> ✅ **Web preview of the member app is live at `/app`** (phone-framed, real shared data, doors splash, booking works).
> **Direction (D-19):** ship the member app as a WEBSITE/PWA first (wire this preview to real member logins + data), native iOS/Android later. Statuses below track the real member-facing app; "(preview ✅)" = built in the demo, needs real-data wiring.

- ⬜ **Splash & Login:** doors-opening owner-photo splash *(preview ✅)*, welcome flow, email OTP login.
- ⬜ **Home:** today's classes, upcoming bookings, membership status, announcements feed *(preview ✅)*.
- ⬜ **Class Schedule:** browse, spots left, book/waitlist *(preview ✅)*; filter by coach/type, cancel booking.
- ✅ **My QR:** real per-member check-in code (`oxround:checkin:<id>`), gated by payment (D-20).
- ✅ **MyOx (D-22):** streak, visits this month vs all-time, milestone badges (10/25/50/100/250), motivational nudge — from real check-in data. ⬜ opt-in leaderboard (later).
- ✅ **Home · MyOx · My QR · More** tab structure; Schedule+booking + Profile under More (D-22). Member app wired to the signed-in member's real data (Step 6C).
- ✅ **QR check-in scanner** (CRM `/scanner`): iPad/phone camera reads member QR → green "Welcome"/red "inactive/payment due" (Step 6D).
- ✅ **Owner notification bell 🔔:** at-risk + overdue alerts, derived live (Step 6F/D-23). ⬜ messages + community-post notifications (need messaging tables).
- ⬜ **Staff Directory:** coach profiles.
- ⬜ **Kiosk Screen:** locked tablet camera view, dynamic states ("Welcome, Marco ✓" / "Membership inactive ✗").
- ⬜ **Push Notifications:** booking confirmed, class cancelled, waitlist opened, announcements — **+ in-app notification feed as fallback when push fails** **[added]**, **push opt-out handled gracefully** **[added]**, **offline mode: cached schedule + graceful errors** **[added]**.

### Infrastructure & Compliance (Phase 1, invisible but required) **[added — section missing from draft]**

- ⬜ Notification queue with retry · membership-expiry cron + silent-failure alerting · CI/CD pipeline · staging environment · error monitoring · uptime checks · verified backups · privacy policy + 72 h breach procedure + Supabase DPA (Law 25) · i18n scaffolding day 1 (strings English-only) · onboarding email sequence with app-store deep links · "app day" activation playbook.

---

## Phase 2 — Growth & Retention

- ✅/⬜ Lead/Trial Kanban pipeline: ✅ full board (New → Contacted → Trial booked → Trialing → Converted/Lost), add lead, move stages, source tracking incl. TikTok/FB, overdue follow-up flags. ⬜ activity logs, follow-up reminders (notifications), who-captured attribution.
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
