# OxRound — Open Decisions & Known Issues

Review this at the start of every session. Resolve decisions before building the affected feature. *Note that when a decision is made, we should not delete it here, we keep it, but we can add a checkmark describing what decision was made*

**Legend:** 🔴 Blocks launch · 🟡 Blocks Phase 2 · 🟢 Can defer

---

[github.com/twentyhq/twenty](https://github.com/twentyhq/twenty)## 🔴 Critical Security Issues (fix before G1 pilot)

### D-01 · Kiosk auth — service role key is a critical flaw

**Problem:** ARCHITECTURE.md §9 proposes the kiosk authenticates with a service role token "scoped to that gym." Supabase service role keys bypass ALL RLS for ALL gyms — they are not scopeable.
**Fix required:** Create a dedicated `kiosk` Postgres role with a gym-scoped JWT (gym_id in claims) and write-only permission on `check_ins`. Never put the service role key on a kiosk device.
**Status:** ❌ Unresolved

### D-02 · QR token hashing — bcrypt is wrong

**Problem:** ARCHITECTURE.md §6 says QR tokens are "stored hashed (bcrypt) server-side." bcrypt is for passwords (intentionally slow). QR tokens are random 128-bit values — use SHA-256.
**Fix required:** Replace bcrypt with `crypto.subtle.digest('SHA-256', token)` in the check-in Edge Function.
**Status:** ❌ Unresolved

### D-03 · RLS FOR ALL enables destructive hard DELETE

**Problem:** The "owner manages members" RLS policy uses `FOR ALL`, which allows hard `DELETE`. Combined with `ON DELETE CASCADE`, this permanently destroys all check_ins, memberships, bookings, and coach_notes for a member.
**Fix required:** Change policy to `FOR UPDATE` only. Implement soft-delete: `UPDATE gym_members SET status = 'archived'` instead of DELETE.
**Status:** ❌ Unresolved

---

## 🔴 Schema Issues (fix before first migration)

### D-04 · No date_of_birth field on profiles

**Problem:** Needed for digital waiver (Phase 2) and age-class boxing compliance. Retrofitting it later requires a migration that may touch thousands of rows.
**Fix:** Add `date_of_birth date` to `profiles` table now, nullable.
**Status:** ❌ Unresolved

### D-05 · payment_status DEFAULT 'unknown' creates data rot

**Problem:** `memberships.payment_status DEFAULT 'unknown'` means every auto-created membership starts as unknown. Queries for overdue members will miss these rows.
**Fix:** Change default to `'pending'` or require explicit value on insert (no default).
**Status:** ❌ Unresolved

### D-06 · UNIQUE(gym_id, user_id) blocks coach-who-is-also-member

**Problem:** A coach who trains at their own gym cannot have two gym_members rows (one as coach, one as member) due to the unique constraint.
**Options:** (a) Allow multiple roles in a single row via `roles text[]`, (b) remove unique constraint and enforce uniqueness per-role in application code, (c) make coach role live in a separate `gym_coaches` table.
**Recommendation:** Option (a) — `roles text[] NOT NULL DEFAULT '{member}'` is simplest and avoids a join.
**Status:** ❌ Unresolved

### D-07 · Boxing-specific member fields not in schema

**Fields needed (Phase 1 collect, Phase 3 surface):** `weight_class text`, `skill_level text`, `fight_record jsonb` (wins/losses/draws), `medical_notes text` (coach-visible only).
**Fix:** Add as nullable columns to `gym_members` now; keep them hidden in UI until Phase 3.
**Status:** ❌ Unresolved

---

## 🟡 Architecture Decisions (resolve before Phase 2)

### D-08 · Auth method for member mobile app

**Problem:** ARCHITECTURE.md proposes magic links. Magic links don't work well on mobile (open browser, deep-link back to app is fragile).
**Options:** (a) Email OTP (6-digit code, native input, best UX), (b) Phone OTP via Twilio/Resend SMS, (c) Social login (Google/Apple).
**Recommendation:** Email OTP for MVP, add Google/Apple login in Phase 2.
**Status:** ❌ Unresolved

### D-09 · Multi-gym coach — single gym_id in JWT

**Problem:** A coach who works at two gyms gets one JWT at login. If gym_id is baked into the JWT, they can only access one gym per session.
**Options:** (a) Re-issue JWT on gym-switch (UX: pick gym at login), (b) include `gym_ids: []` array in JWT + RLS accepts any matching gym_id, (c) force coach to have two separate accounts.
**Recommendation:** Option (a) for MVP (rare edge case); revisit in Phase 3 multi-location work.
**Status:** ❌ Unresolved

### D-10 · Offline check-in fallback

**Problem:** If kiosk loses internet, QR scans fail silently. Gym entrance becomes a bottleneck.
**Options:** (a) Cache member QR token list on kiosk daily, validate locally, sync when reconnected, (b) PIN-based fallback (member enters 4-digit code), (c) coach manually marks attendance in CRM.
**Recommendation:** Option (c) for MVP (simplest); Option (a) in Phase 2 if G1 reports connectivity issues.
**Status:** ❌ Unresolved — confirm with G1 owner whether their venue has reliable WiFi

### D-11 · Waiver/contract system

**Problem:** Every gym needs members to sign a liability waiver. No waiver system exists in current architecture.
**MVP workaround:** Paper waiver on first visit, scanned and uploaded to Supabase Storage per member.
**Phase 2:** Digital waiver (PDF generation + e-signature via DocuSeal or custom canvas signature).
**Status:** ✅ Deferred to Phase 2 — paper waiver is acceptable for G1 pilot

### D-12 · i18n (French/English)

**Problem:** Quebec market requires French. G1 pilot owner is comfortable in English for admin but members may expect French.
**Fix:** Scaffold `react-i18next` (CRM) and `i18n-js` (Expo) at project init. Add English strings only. Add French translations before 5th gym onboarding.
**Status:** ❌ Scaffold not yet added to architecture

### D-13 · Feature flag mechanism

**Options:** (a) `gyms.settings jsonb` (free, already in schema, no external dependency), (b) PostHog feature flags (requires PostHog to be set up, gives UI to toggle), (c) Hardcoded env vars (not per-gym).
**Recommendation:** Option (a) for MVP; migrate to PostHog flags in Phase 2 once PostHog is instrumented.
**Status:** ❌ Unresolved

---

### D-19 · Member app: website-first (PWA) before native

**Decision (2026-07-04):** Build the member app as a responsive website (installable PWA at `/app`) FIRST, and ship native iOS/Android apps later as an upgrade. Supersedes the native-first plan in DEPLOY.md Phase C for the pilot.
**Why:** the full QR check-in loop needs no native powers — the member only *displays* a QR (any browser does this), and the iPad *reads* it via browser camera in the owner's CRM (which also sidesteps D-01 kiosk auth, since the iPad is logged in as the gym). Ships in ~days vs ~1–2 months, $0 vs Apple $99/yr + store reviews, and it's the same Expo codebase the native apps later grow from.
**Known trade-off (accepted):** reliable push notifications need native — website push is Android-only in practice and requires "Add to Home Screen" on iPhone ([Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)). Push is a retention polish, not needed for check-in; it's the main reason to build native later, once G1 is paying.
**Build checklist:** member magic-link login + per-member RLS → wire `/app` preview screens to real member data → real "My QR" token → booking writes → iPad scanner page in CRM → end-to-end test. Native app (old Phase C / DEPLOY) deferred to post-pilot.
**Status:** ✅ Decided, plan recorded — build not started (user: "only record the plan for now").

### D-20 · Unpaid members lose QR / check-in access

**Spec (2026-07-04):** a member who isn't paying can't check in. Enforced in TWO layers:

1. **Member app** hides the My QR tab, showing "Membership payment due — see the front desk" (nudge).
2. **`check-in` function** re-checks payment status at scan time and rejects with red "Payment due ✗" (authoritative — a screenshot of an old QR must still fail, since the QR token is static).
   **Open questions (need G1 input before final rule):**

- What counts as "not paying"? Default: `payment_status='overdue'` = blocked; `comped` (staff/free) always exempt; `pending` (new member, first invoice unpaid) — block or allow? TBD.
- Grace period: block the instant payment is late, or allow N days? Locking a loyal member over a late e-transfer is bad UX — most gyms allow a short grace window. **G1 business decision.**
  **Related:** extends the existing "deactivated membership ⇒ scan rejected" behavior (D-03/check-in fn) from *status* to *payment_status*.
  **RESOLVED (2026-07-04):** there IS a grace period (avoid locking a loyal member over a late e-transfer). During grace, the member keeps QR access, but the **owner is notified** — a small callout/textbox in the CRM's notification area flags "X is past due (in grace until DATE)" so the owner can act. After grace expires unpaid → QR blocked (app hides + scanner rejects). `comped`/staff always exempt. Exact grace length = G1 business input (default 7 days).
  **Status:** ✅ Resolved — grace period + owner notification; build with Step 6 (6C3, 6D, 6F3 bell).

### D-21 · Coaches (and receptionists) get a role-scoped CRM view, not a separate app

**Spec (2026-07-04):** coaches and receptionists log into the SAME CRM as the owner, but see a restricted set of tabs/actions by role — not a third separate web app. Enforced two layers: UI hides tabs/buttons by role (UX), and RLS/role checks block the data server-side (authoritative — a coach can't reach payments by typing the URL).
**Default permissions matrix (needs G1 confirmation):**

- `owner` / `manager`: everything.
- `coach`: view schedule + their assigned classes, class rosters, mark attendance/no-show, run check-in scanner, view member contact info. NO payments, plans, settings, reports, revenue.
- `receptionist`: coach set + record payments + check-in. NO settings, no revenue reports.
- `member`: member app only (never the CRM).
  **Why same-app-scoped:** one codebase, one deploy; matches how the roles array + `is_staff()` already work. A separate coach app would triple maintenance for no benefit.
  **Status:** ✅ Approach recorded — exact per-role permissions pending G1; build within Step 6 (6A2 router, 6B2 visibility).

### D-22 · Member app tab structure — add "MyOx" engagement tab, move Schedule under "More"

**Spec (2026-07-04):** restructure the member web app's bottom nav for retention.

- **New primary tab "MyOx"** — personal analytics + gamification to drive daily return: current streak (🔥 N weeks), visits this month vs last, total-classes milestones/badges, personal bests, motivational nudges ("2 more to beat last week"), opt-in leaderboard (later). Built from check-in data already collected (CRM `attendanceSummaries()` already computes streaks/visits).
- **Schedule + booking move under a "More"/Settings area** (with Profile, membership, account) — no longer a primary tab.
- Likely primary tabs become: **Home · MyOx · My QR · More**.
  **UX flag (accepted by product owner):** Schedule is a high-frequency action; burying it may reduce bookings. Mitigation: keep a "Book next class" shortcut on Home even with the full schedule under More.
  **Status:** ✅ Direction recorded — build within Step 6 (member app, 6C). Update the `/app` preview to match when convenient.

### D-23 · Messaging + Community tab + notification bell

**Spec (2026-07-04):** add member↔gym communication across both apps.

- **Community tab** (both CRM and member app): staff (owner/coach) post; members view + react. This is the existing `announcements` feature (table, reactions, read-counts already built) surfaced as a "Community" tab. Members are read+react only; staff post.
- **Messaging** (net-new): direct messages between staff and members. **RESOLVED (2026-07-04): two-way 1:1 + broadcast.** Staff and members can message each other; staff can also broadcast to all (or segments later).
- **Notification bell** 🔔 in the top bar of both apps: carries THREE kinds — (1) direct messages, (2) new community posts, (3) **system/automated notifications** (below). Schema already has a `notifications` table + `announcement_reads` scaffolding.
- **System notifications (role-specific content):**
  - *Owner/staff CRM:* at-risk member (drop-off), payment overdue, new member joined/activated, waitlist filled, low class capacity. Start with **at-risk + overdue** (data already computed on the dashboard).
  - *Member app:* class starting soon, booking reminder, class cancelled, waitlist opened, membership expiring, payment due.
  - *Two implementation styles:* **derived/computed** live from existing analytics (at-risk, overdue — near-zero new work, reuses dashboard logic) vs **stored events** in the `notifications` table (cancellations, bookings, activations).
    **Permissions:** owner/coach = post to community + send messages; receptionist per D-21; member = view community + react, receive/reply to messages (if two-way).
    **Relation to existing:** pulls the Phase 3 "community feed (gym-scoped)" and "email blast" ideas forward; the "in-app notification feed" already noted as push fallback becomes this bell.
    **Status:** ✅ Resolved (2026-07-04) — two-way 1:1 + broadcast; build within Step 6 (6F).

### D-24 · Member onboarding lifecycle — invite → join → activate-on-payment

**Spec (2026-07-04):** replace "add member ⇒ instantly active" with a proper lifecycle. Two independent states:

- **Account state** (`gym_members.user_id`): empty = invited/not claimed; set = they logged in.
- **Membership state** (`memberships.payment_status`): pending = not paying yet; paid = active.
  **Flow:**

1. Owner adds member in the Members tab (name + email). Member row created as **Invited**: no `user_id`, a `memberships` row with `payment_status='pending'`. NOT fully active. QR does not work yet.
2. System emails an **activation magic link** to that email (invite-only signup — this IS the invite).
3. Member clicks link → logs in → `user_id` populated → **Joined-unpaid**: can open + browse the app (schedule, community, profile) but **QR/check-in blocked** (= D-20 payment gate).
4. Owner records the member's payment (Payments tab) → `payment_status='paid'` → **Active**: QR works, can check in.
   **Members-tab UI:** show the real state — Invited / Joined-unpaid / Active / Overdue — not just "active".
   **Dependencies:** (a) emailing real members needs custom SMTP (Resend) + verified domain — same wall as owner invite (5.4); testable with own emails until then. (b) the invite-send runs server-side with the service-role key (net-new small server action / Edge Function) — never in the browser.
   **Relation:** the QR gating is exactly D-20; comped/staff skip the payment gate.
   **RESOLVED (2026-07-04):** an invited member who logs in DOES get app access (browse schedule/community/profile) but their status is **inactive with no QR set up** until the owner confirms payment — then they become active and the QR works. Matches D-20.
   **Status:** ✅ Resolved — build within Step 6 (member onboarding); email step blocked on domain.

## 🟢 Business / Strategy Decisions (can defer)

### D-14 · Budget projection vs. investor brief target mismatch

**Problem:** BUDGET.md projects 50 gyms in 12 months. Investor Brief states 10 gyms in 12 months. 5x discrepancy.
**Fix:** Align BUDGET.md 12-month projection to 10-gym target (investor brief is the external-facing document, it controls).
**Status:** ❌ Unresolved — BUDGET.md needs revision

### D-15 · CAC and churn not modeled

**Problem:** BUDGET.md models $0 churn and $0 CAC. Realistic: 2–5%/month churn, ~$600–675 CAD CAC per gym at $75/hr founder time.
**Fix:** Add churn and CAC rows to BUDGET.md Tier projections.
**Status:** ❌ Unresolved

### D-16 · Payment processing revenue (gemini_ideas vs. investor brief)

**Problem:** gemini_ideas_june.pdf proposes taking 0.5% of gym transactions as a revenue stream (at 20 gyms × $15k/mo = $1,500/mo passive). ARCHITECTURE.md §10 also lists this but states it incorrectly as 0.5% — correct Stripe rate is 2.9% + $0.30.
**Clarification needed:** Ilo fltes lo ots
**Status:** ❌ Unresolved — define the margin model before building Stripe Connect

### D-17 · Kiosk hardware decision for G1

**Options and costs (CAD):**

- Refurbished iPad (9th gen) — $250–350 — iOS Guided Access for kiosk mode
- Owner's existing iPad — $0 — confirm they have one
- Fire HD 10 — $130–180 — Android kiosk mode (cheaper, slower)
- Wall-mounted Android kiosk — $150–200 — most professional look
  **Recommendation:** Use owner's existing iPad for G1 pilot to keep cost at $0. Sell refurb iPad as optional add-on for future gyms.
  **Status:** ❌ Not confirmed with G1 owner

### D-18 · Stripe Connect for gym-to-member payments (Phase 2/3)

**Problem:** Cannot import gym's existing stored card data from another processor (PCI compliance). Members would need to re-enter payment methods.
**Implication:** Frame as "upgrade your payment experience" not "migration." Include in gym onboarding communication.
**Status:** ✅ Acknowledged — no action until Phase 2

---

## Resolved Decisions

*(Move items here once decided)*

| Decision                    | Resolution                                                                                                                                                                                       | Date                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| D-02 QR hashing             | SHA-256, column`check_in_token_hash` — in migration 0001 + check-in Edge Function                                                                                                             | 2026-07-02           |
| D-03 RLS soft-delete        | No FOR ALL/DELETE policies anywhere; archive via`status='archived'` — migration 0002, validated by scripts/validate-migrations.mjs                                                            | 2026-07-02           |
| D-04 date_of_birth          | Added to`profiles` in migration 0001                                                                                                                                                           | 2026-07-02           |
| D-05 payment_status default | `'pending'` — migration 0001                                                                                                                                                                  | 2026-07-02           |
| D-06 coach-also-member      | `roles text[]` (option a) — migration 0001                                                                                                                                                    | 2026-07-02           |
| D-07 boxing fields          | `weight_class`, `skill_level`, `fight_record`, `medical_notes` in migration 0001, hidden in UI                                                                                           | 2026-07-02           |
| D-08 member app auth        | Email OTP for mobile; magic link stays for CRM web                                                                                                                                               | 2026-07-02           |
| D-10 offline kiosk          | Option (c) manual check-in in CRM for pilot (button on member profile)                                                                                                                           | 2026-07-02           |
| D-13 feature flags          | `gyms.settings` jsonb (option a)                                                                                                                                                               | 2026-07-02           |
| D-01 kiosk auth             | Pattern implemented (RLS`is_kiosk()` insert-only policy + check-in function honors `kiosk:true` claim). **Kiosk JWT minting flow still to build** — do not deploy a kiosk before then | 2026-07-02 (partial) |
