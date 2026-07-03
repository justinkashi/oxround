# OxRound — Product Roadmap

**Philosophy:** Solve one problem exceptionally well first — "Run my gym digitally while giving members an app they'll actually use." Everything else comes after revenue.

**Strategy:** Win by being boxing-specific and operator-obsessed, not by matching Mindbody feature-for-feature. Depth beats breadth for a 2-person team.

---

## Phase 1 — MVP (0–3 months) · Target: G1 Boxing pilot → 3 paying gyms

### What's In

**Member App (8 screens)**

| Feature | Notes |
|---|---|
| Auth (login, register, forgot password, join via invite code) | Magic link for web onboarding; OTP for mobile |
| Dashboard (today's classes, upcoming bookings, membership status, announcements) | First screen after login |
| Class schedule (browse, filter by coach/type, view spots) | Core retention hook |
| Class booking (book, cancel, join waitlist) | Gating = strongest member activation lever |
| QR check-in (member shows QR, kiosk scans) | Must work offline on kiosk side |
| Membership status (type, renewal date, active/frozen/expired) | No payment collection in app yet |
| Push notifications (booking confirmed, class cancelled, waitlist, announcements) | Expo Push → APNs/FCM |
| Basic profile (name, photo, phone, email, emergency contact) | DOB needed for waiver |

**CRM (10 modules)**

| Module | Notes |
|---|---|
| Dashboard (today's classes, attendance, active members, expiring memberships) | Owner's landing page |
| Member management (create, edit, suspend, delete/archive, search, view attendance/notes) | Soft-delete only — never hard DELETE |
| Coach management (add/remove, permissions, schedule, profile) | Coach can be gym_member simultaneously |
| Class management (create/edit/delete, recurring, capacity, waitlist, attendance, coach assignment) | |
| Membership management (monthly/annual/drop-in/punch card, assign/freeze/renew/expire) | |
| Booking management (view booked members, waitlist, spots, late cancels) | |
| Basic payment tracking (paid/pending/cash/e-transfer/card, invoice history) | Manual tracking only — no Stripe yet |
| Announcements (push notification + in-app post + email blast) | Photo support for gym closure, events, etc. |
| QR check-in dashboard (live feed via Supabase Realtime, kiosk management) | |
| Settings (gym logo, info, hours, membership types, class colors, cancellation policy) | |

**Infrastructure (must be live for pilot)**

- Supabase project (prod + staging)
- GitHub Actions CI/CD (lint → typecheck → test → migration → Vercel deploy → EAS Update)
- Sentry error monitoring
- Resend transactional email
- Quebec Law 25 privacy policy + data deletion flow

### What's NOT in Phase 1

These are explicitly deferred. Do not scope-creep:

- ❌ Stripe / Square / Moneris payment processing (manual tracking only)
- ❌ Lead/trial Kanban pipeline
- ❌ Coach notes (deferred to Phase 2)
- ❌ Attendance analytics dashboard
- ❌ CSV export
- ❌ Digital waiver (deferred — interim: paper waiver)
- ❌ i18n / French language (deferred — G1 pilot is bilingual but owner is comfortable in English for admin)
- ❌ Multi-gym support
- ❌ Community feed / social features
- ❌ AI anything
- ❌ In-app payments (member side)
- ❌ Referral program
- ❌ Instagram / WhatsApp integration
- ❌ Website add-on widget
- ❌ Boxing-specific fields (weight class, skill level, fight record) — collect but don't surface yet

---

## Phase 2 — Growth (3–6 months) · Target: 5–20 paying gyms

Unlock after G1 pilot proves the core works and 3 gyms are paying.

**CRM additions**
- Lead / trial Kanban pipeline (source → contacted → trial class booked → converted → lost)
- Coach notes (private, per-member)
- Follow-up reminders (automated, based on trial date)
- Attendance analytics dashboard (popular classes, coach performance, member frequency)
- Coach invite flow (email invite → role assignment)
- Digital waiver (PDF generation + e-signature, stored in Supabase Storage)
- CSV export (members, attendance, payments)
- i18n — French/English toggle (react-i18next)

**Member App additions**
- Workout plans (coach-assigned)
- Skill progression tracking
- In-app payment (Stripe) — subscription billing
- Event registration
- Push reminders (upcoming class, membership expiry)
- Referral program

**Infrastructure**
- Stripe integration (OxRound collects from gyms; gym-to-member payment is Phase 3)
- PostHog product analytics
- Feature flags (PostHog or gyms.settings jsonb)
- Automated membership expiry via pg_cron

---

## Phase 3 — Platform (6–12 months) · Target: 20–100 gyms

Unlock after product-market fit is confirmed and MRR is sustainable.

**Boxing-specific depth (competitive moat)**
- Grade/rank tracking (belt progression, fighter levels)
- Pad-work scheduling (1:1 sessions overlaying group classes)
- Fight camp management (sparring frequency, weight cuts, training load for competing fighters)
- Injury notes (coach-visible, private from gym owner)
- Weight class / fight record fields on member profile

**Revenue expansion**
- Website add-on widget (public class schedule embeddable on gym's website)
- Gym-to-member payment processing via Stripe Connect (OxRound takes 0.5% cut)
- Advanced reporting (MRR, churn, LTV projections)
- Staff payroll support

**Member experience**
- AI training recommendations (Phase 3 minimum viable version)
- Boxing/MMA training library
- Community feed (gym-scoped, not cross-gym)
- Cross-gym memberships
- Gym discovery

**Infrastructure**
- Multi-location support (one owner account, multiple gym_ids)
- Dedicated kiosk hardware program (OxRound-branded Android kiosk)
- LLM CoPilot for owner (text-to-SQL: "which members attended 3+ times last week but haven't paid?")

---

## Future Vision (post-Series A)

From gemini_ideas_june.pdf — do not plan for these yet:

- AI coach (computer vision for fight form, punch volume/velocity analysis)
- Predictive churn & injury modeling (XGBoost on attendance decay + payment history)
- Autonomous lead conversion agent (Instagram DMs + website widget + SMS, 24/7)
- Tournaments / event management
- Cross-gym marketplace
- Wearables integration
- Nutrition plans

---

## Pricing (target)

| Plan | Price | Who |
|---|---|---|
| Starter | $99–149 CAD/mo | 1 location, up to 100 members |
| Pro | $199 CAD/mo | 1 location, up to 300 members, advanced reporting |
| Growth | $299+ CAD/mo | Multi-location, white-label, priority support |

Add-ons: Website widget (+$49/mo), Done-for-you onboarding (+$299 one-time), Payments processing (0.5% of gym transactions).

---

## Competitors to track

PushPress, Gymdesk, Wodify, WellnessLiving, Mindbody, Kicksite, Zen Planner, Exercise.com; adjacent: Everfit (coach-side training platforms, Phase-3 benchmark), GymWise.ai (AI retention layers). Full business analysis: `COMPETITORS.md`. Advantage confirmed 2026-07: none are boxing-native — Zen Planner has MMA/BJJ pages but no boxing line; pad-work scheduling and fight camp management remain unserved.
