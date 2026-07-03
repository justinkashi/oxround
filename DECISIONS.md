# OxRound — Open Decisions & Known Issues

Review this at the start of every session. Resolve decisions before building the affected feature.

**Legend:** 🔴 Blocks launch · 🟡 Blocks Phase 2 · 🟢 Can defer

---

## 🔴 Critical Security Issues (fix before G1 pilot)

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
