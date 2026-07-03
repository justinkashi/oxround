# OxRound — Product Maintenance Plan

Reference this when shipping, when something breaks, or when planning quarterly work.

---

## Dependency & Security Maintenance

**Cadence:** Monthly dependency review. Immediate patching for critical CVEs.

- Run `pnpm audit` weekly via GitHub Actions CI (add to existing lint/typecheck workflow).
- Configure Renovate Bot: auto-merge patch updates that pass CI; flag minor/major updates for manual review.
- Monitor Supabase changelog weekly — Pro plan sometimes pushes breaking changes to Edge Functions or PostgREST behavior with short notice.
- Monitor Expo SDK changelog — new SDK versions require `expo-camera`, `expo-notifications`, and other native modules to be updated together. Never update Expo SDK without allocating a full day for regression testing on both iOS and Android.
- Subscribe to security advisories for: Next.js (critical SSR vulns have occurred), React Native, Deno (Edge Functions runtime), Supabase.

**Failure mode table:**

| Dependency | Failure Mode | Mitigation |
|---|---|---|
| Supabase Auth | Auth tokens invalid, login broken | Sentry uptime check on `/auth/v1/health` |
| Expo EAS | Build/deploy blocked | Maintain last-known-good binary on TestFlight; OTA as hotfix path |
| Resend | Emails not delivered | Queued in `notifications` table; retry on next pg_cron run |
| Expo Push | Push not delivered | Graceful degradation; in-app notification feed as fallback |
| Stripe | Billing blocked | No immediate user-facing impact; fix within 24 hours |

---

## Database Maintenance

**Migrations:** Every schema change is a migration file in `supabase/migrations/`. No direct schema edits via Supabase Studio in production. Ad-hoc Studio edits create schema drift that cannot be tracked or replicated. Non-negotiable.

**Backups:** Supabase Pro includes daily backups with 7-day retention. Download and restore a backup monthly to verify it works. Add Point-in-Time Recovery (PITR, +$100/mo) only when you have 20+ paying gyms.

**Index review:** Run `EXPLAIN ANALYZE` quarterly on the 5 most common queries: member list, check-in feed, attendance history, class schedule, lead pipeline. Add indexes where full table scans appear.

**Data retention:**
- Check-in records older than 3 years → archive or delete (verify against Quebec Law 25 requirements)
- Cancelled memberships → anonymize PII after 1 year
- Former members → soft-delete with 2-year data hold for tax/legal purposes

**pg_cron monitoring:** pg_cron failures are silent by default. Create a `cron_job_log` table that each job writes to on start and completion. If a job's last success is >26 hours ago, trigger a Sentry alert. Critical for membership expiry and payment reminder email jobs.

---

## Mobile App Maintenance

**App Store compliance:** Subscribe to Apple Developer Program announcements and Google Play Policy Center. Key ongoing: privacy manifests (required iOS 17+), minimum target SDK versions (Google requires within 1 year of current), permission usage descriptions.

**OTA vs. binary update:**

| Use OTA (EAS Update) for | Require binary build (App Store review) for |
|---|---|
| Bug fixes, UI changes, copy changes | New native modules |
| New screens (no new native modules) | App icon or name changes |
| Hotfixes | Major version bumps Apple/Google require |

In practice: OTA for all hotfixes and minor features (1–2 week cycle), binary update monthly or quarterly.

**OS version support:** iOS current + 1 major back. As of 2026: iOS 17 and 18. Drop iOS 16 when <5% of active users are on it (visible in Expo analytics). Android 12 (API 31) and above — below this is <10% of Android devices globally.

**Versioning:** `MAJOR.MINOR.PATCH`. Tag every production release in git.
- MAJOR: significant feature releases (new tab in member app, new CRM section)
- MINOR: new features within existing sections
- PATCH: bug fixes

Keep `CHANGELOG.md` in plain language for owners: "You can now see which coach is assigned to each class" — not "Added coach_id display to ClassSessionCard component."

**Regression test checklist (run before every binary release):**

1. Fresh install on iOS — login via magic link/OTP works
2. Fresh install on Android — login via magic link/OTP works
3. QR code displays on member's phone — generates and renders
4. Kiosk scan of member QR — check-in succeeds
5. Class booking — can book, receives push confirmation
6. Class cancellation — removes booking
7. Announcement — owner creates → member receives push → taps → opens announcement
8. Membership deactivation — owner deactivates → member QR fails on kiosk → member sees inactive status
9. Push notification opt-out — member disables notifications → no errors thrown
10. Offline mode — app opens without internet → shows cached schedule → graceful "connection needed" for actions requiring internet

---

## Monitoring & Incident Response

**Uptime monitoring (Sentry or UptimeRobot):**
- `app.oxround.com` — alert if HTTP 200 not returned in 30 seconds
- Supabase API health endpoint — alert on non-200
- Edge Function check-in endpoint — alert if latency >2 seconds

**Error thresholds:**
- >5 errors/minute → P1 (page immediately)
- 1–5 errors/minute → P2 (notify within 1 hour)
- Isolated errors → P3 (review daily)

**Incident levels:**

| Level | Definition | Response Time | Action |
|---|---|---|---|
| P0 — System Down | Check-in broken or CRM inaccessible | <30 min | Drop everything; hotfix OTA or rollback |
| P1 — Feature Broken | QR codes not generating, push not sending | <2 hours | Hotfix OTA if possible |
| P2 — Degraded | Slow load times, occasional errors | <24 hours | Fix in next deploy |
| P3 — Minor | UI bug, display error | <1 week | Queue for next sprint |

**Communication during incidents:** For P0/P1, proactively message affected gym owners via email or WhatsApp before they notice. "We're aware of an issue with X and are fixing it — estimated resolution in 30 minutes." Silence during an incident is the worst response.

**Post-incident:** After every P0/P1, write a 1-paragraph post-mortem (what happened, root cause, fix, prevention). Archive in `INCIDENTS.md` in the repo.

---

## Feature Development Process

**Release cadence:**
- Weeks 1–3: Build and test new features in development/staging
- Week 4: Feature freeze — bug fixes only. Deploy to production. Push OTA update.
- Monthly binary build for App Store if native changes are included.

**Feature flags:** Use `feature_flags` jsonb on the `gyms` table (checked client-side) for MVP. Migrate to PostHog feature flags in Phase 2. This lets you enable a feature for G1 Boxing only while building it, roll out to 10% of gyms, or kill a feature remotely without a redeploy.

**Feedback loop:** After every feature release, send a 3-question in-app survey to gym owners:
1. "Did you notice the new [feature]?" (Yes/No)
2. "If yes, is it useful?" (1–5)
3. "What's the one thing you wish we'd fix or add?" (free text)

10 gym owners × 3 questions every 4 weeks = 30 qualitative data points per month.

**Prioritization rule:** The next feature to build is always the answer to: "what is causing the most support requests?" Track every support message. If 5 different gyms in one month ask for the same thing, that is the next feature. Build from support tickets, not roadmap speculation.

---

## Customer Support

**Channels:** Email (support@oxround.com) + WhatsApp. Use a shared Gmail inbox labeled by gym name for the first 12 months — no ticket system needed yet.

**Response SLAs:**

| Plan | Response Time |
|---|---|
| Starter | 24 business hours |
| Pro | 8 business hours |
| Growth | 2 business hours + dedicated WhatsApp contact |

**Scripted resolutions for common issues:**

1. **"A member can't log in"** → Check if their email is confirmed in Supabase Auth. Resend magic link / OTP.
2. **"QR isn't working at the door"** → Check `gym_members.status`. If inactive, explain to owner. If active, check kiosk internet connectivity.
3. **"A member's class doesn't show up"** → Check `class_sessions` for that date — was it generated? Was it cancelled?
4. **"I accidentally deactivated a member"** → Archive action is reversible — set `gym_members.status = 'active'` in the CRM.
5. **"Push notifications aren't arriving"** → Check `push_tokens` for that member's device. If missing, member needs to re-log in to re-register their push token.

**Escalation:** All issues requiring a code change go to GitHub Issues with label `customer-reported`. Link the gym and member in the issue body. No untracked verbal commitments.

---

## Compliance (Quebec/Canada)

**Quebec Law 25 (Act Respecting the Protection of Personal Information):**

Fully enforced as of September 2023. OxRound collects: name, email, phone, date of birth, attendance records, payment status, emergency contacts — all personal information under Law 25.

Action items:
1. Write and publish a privacy policy
2. Build "download my data" feature (CRM exports member data as JSON/CSV)
3. Build "delete my account" flow (anonymize PII, retain 2 years for legal)
4. Designate a privacy officer (one of the founders)
5. Add breach notification procedure to incident response plan (72-hour mandatory notification)

**PIPEDA (federal):** Law 25 supersedes PIPEDA in Quebec for provincially-regulated businesses. No additional action if Law 25 is complied with.

**Data residency:** Supabase US-East-1 (Virginia). Law 25 does not mandate Canadian data residency (as of 2026) but requires contractual protections when data is stored outside Quebec. Sign Supabase's Data Processing Addendum (DPA). Store a copy.

**Annual compliance review (every January):** Review Law 25 for legislative updates, audit data retention policies, confirm Supabase DPA is current, test "delete my data" flow end-to-end.

---

## The One Risk That Will Actually Kill the Product

None of the above technical risks are the likely failure mode. The real risk is **key-person dependency**: if the technical co-founder gets sick, burns out, or exits, the product stops receiving updates. Gym owners tolerate 2–3 months of stagnation before churning.

Mitigation (not a backup engineer — documentation):

- Every Edge Function gets a README: inputs, outputs, failure modes.
- Every Supabase migration gets a comment explaining why the change was made.
- `RUNBOOK.md` covers: how to deploy a hotfix, how to roll back a bad OTA, how to reset a stuck pg_cron job, how to onboard a new gym manually if the import script fails.
- Record a 10-minute Loom walkthrough of each major module. A contractor who inherits this should be productive within days.
