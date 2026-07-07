# OxRound — START HERE

**What this is:** B2B SaaS for boxing gyms — a web CRM for owners + a mobile app for members.
**First customer:** G1 Boxing (Vaudreuil-Dorion, QC).

---

## CURRENT STATUS — the only place this lives

> **Update this block + flip ✅/⬜ marks in FEATURES.md after every work session. Nothing else needs updating.**

- **Phase:** LIVE (real auth in production). Supabase project `oxround` (ref `ymhbsvjqklqtfcitonzs`, ca-central-1): all 7 migrations applied, edge functions `check-in` + `auth-hook` + `invite-member` all ACTIVE, token hook + buckets + Resend SMTP configured. Magic-link login works end-to-end; the owner lands in the real CRM. NOTE: "demo mode" is only the automatic fallback that kicks in when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are unset (e.g. running `pnpm dev` locally with no `.env`) — it is NOT the state of the deployed site.
- **Built:** full clickable CRM (dashboard/live feed/at-risk, members, classes grid + rosters + waitlist, attendance, payments, plans, leads Kanban, coaches, announcements, reports+CSV, settings, mock login) + member-app preview at `/app` + responsive pass (mobile nav, stacking layouts, scrollable tables — desktop unchanged).
- **DEPLOY.md status:** Steps 1–3 ✅, 4.5 (2FA) ✅, 5.1 (real auth CODE) ✅ built & verified — magic-link login, session guard (`apps/web/src/proxy.ts`), logout, `/auth/callback`, owner bootstrap SQL at `supabase/bootstrap-owner.sql`. Pending: 4.0 domain purchase (Resend prerequisite), 5.2–5.8 (config + owner onboarding).
- **AUTH LIVE (2026-07-05):** real magic-link login working end-to-end on production — owner logs in, lands in real (empty) CRM. Domain `oxround.com` on Cloudflare; `app.oxround.com`→Vercel (propagating); Resend verified, Supabase SMTP live (emails send from no-reply@oxround.com, 30/hr).
- **Step 6 core BUILT (2026-07-05, verified compiling):** role routing + staff/member guard (6A), role-scoped CRM nav (6B), member web app on real data — Home/MyOx/MyQR/More, real QR gated by payment (6C, D-20, D-22), iPad `/scanner` QR check-in (6D), owner notification bell (6F partial), new-member starts unpaid/pending (6G/D-24 data side).
- **Step 6 messaging/community/invite BUILT (2026-07-05):** `messages` table + RLS (migration 0005, applied live), CRM `/messages` (1:1 reply + broadcast), member app Community tab (feed + message the gym), `invite-member` Edge Function (emails activation link + links account — NEEDS DEPLOY: `supabase functions deploy invite-member` + secret `APP_URL`). Grace period default = 7 days (`GRACE_PERIOD_DAYS`).
- **Step 6 REMAINING:** message-unread counts on the bell + member push; grace-period auto-timer (needs billing dates). Lockfile fixed (pglite leak removed) — Vercel build passes.
- **VERSION 2 RESILIENCE + TWENTY TRANSFER BUILT (2026-07-06):** retry/backoff + idempotency keys + toasts + double-submit guard on every mutation (`lib/resilience.ts`, `lib/useSubmit.ts`); DestructiveActionModal (type-to-confirm) on all 4 destructive actions; members list server-paginated (50/page) with filter chips (All / Past due / New this month); **Fighter Card** member profile (3-column: status badge · Timeline/Notes/Tasks/Files tabs · quick actions); leads kanban $/mo aggregates + convert-to-member guardrail; CSV import per-row validation; **Playwright e2e suite — 14 tests, all passing** (`pnpm test:e2e`; first run: `pnpm exec playwright install chromium`). Typecheck clean.
- **TO DEPLOY:** (1) `git push` — Vercel builds the new UI. (2) **Migrations 0009 + 0010 + 0012 NOT fully live** (Supabase connector kept dropping): only 0009's function-hardening chunk applied. Paste `supabase/migrations/00000000000009_db_hardening.sql`, `00000000000010_timeline_tasks_attachments.sql`, then `00000000000012_member_profile_fields.sql` into the Supabase dashboard SQL editor (safe to re-run: DROP IF EXISTS / IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout). Until 0010 runs, the Fighter Card's Activity/Tasks/Files tabs and lead $-values will error politely on production; until 0012 runs, DOB/age saving will fail on production (demo mode unaffected). (3) Still pending from last session: `supabase functions deploy invite-member` + `supabase secrets set APP_URL=<vercel url>`.
- **Decided not yet built (D-19/D-21):** ONE login routes by role — owner/manager→full CRM, coach/receptionist→restricted CRM view (same app), member→`/app` web app; CRM gets a Scanner tab, member app gets a My QR tab; full end-to-end QR check-in. Native apps later. Full checklist = DEPLOY.md Step 6.
- **Accounts ready:** Sentry ✅ + Resend ✅ made (wiring in DEPLOY 5.4 + 5.9). Domain still to buy.
- **Members page hardened + backend audited + tests added (2026-07-06):** Members now supports edit fields, archive + restore (soft-delete, undoable), resend-invite, a single batched roster query (was N+1), a duplicate-email guard, and loading/empty/error states. **Backend audit** (rolled-back SQL run as a real authenticated owner and member): all 14 owner write paths pass; a member is denied every staff action and sees 0 roster rows — the grant fix (0007) + policies (0006) make the whole app's real write paths work. **New `supabase/tests/rls_workflows.test.sql`** (pgTAP, `supabase test db`) locks this in. `invite-member` is now v5 (`verify_jwt` off, reads the caller's role from the signed token). Note: `gym_members` edit/archive is owner-only per `members_owner_update` (widen to managers later if needed).
- **G1 FEEDBACK ROUND (2026-07-07, in progress — items 1–2/9 done):** Members page header stats — Total members + New this month cards (click = filter), new `getMemberStats()` in data.ts (demo + Supabase branches). Member profile fields/edit built on Fighter Card + Members edit modal: first/last/email/phone, DOB→age, weight class, date joined, membership type edit, and Timeline renamed Activity. Remaining, one-by-one: remove class location · class edit · Classes/Schedule page split with overlap rendering · coaches add/edit · leads trial automation · announcements notify opt-in · settings website domain.
- **BILINGUAL EN/FR ROLLOUT BUILT (2026-07-07):** typed `lib/i18n` dictionaries, browser-saved EN/FR toggle in login + sidebar, localized CRM/member app copy, status labels, destructive modals, DB error fallbacks, dates and CAD currency across dashboard, members, Fighter Card, classes/rosters, attendance, payments, leads, announcements, messages, reports, scanner, settings, auth/no-access.
- **Last updated:** 2026-07-07 AM (G1 feedback item 2 built and typechecked: member profile fields/edit + Activity rename). Prior: bilingual EN/FR rollout built and typechecked. Prior: 2026-07-06 PM (VERSION 2 resilience + Twenty transfer session — see the two bullets above). Prior: 2026-07-05 (**CRITICAL FIX — migration 0007:** the `authenticated` role had NO table grants, so every logged-in read came back empty and every write failed with "permission denied" — this is exactly why **Add member** showed "could not add." Granted SELECT/INSERT/UPDATE to `authenticated` on all public tables (DELETE withheld per D-03); RLS still gates which rows. Verified live: the full add-member path succeeds under real owner login. Also this session: Members CSV bulk-import; **phone now optional** (blank → null); real DB error messages now surface in the form instead of a generic fallback; notification-bell dropdown no longer clips on desktop. State: production = real auth, 7 migrations applied. **invite-member redeployed v4 with `verify_jwt` OFF** (it self-authenticates via getUser + staff-role check) — this fixes the silent non-2xx that blocked invite emails (the gateway was rejecting the call before the body ran); it now also links already-registered users and logs failures. Add-member shows a clear ✓ and treats the invite as best-effort. Prior: login Member/Coach/Owner tabs are cosmetic — server routes by real role.)

**The direction in one sentence:** finish making both products fully clickable on your laptop for free, use that to win G1, then pay to put it online.

---

## What's in this folder

### Code (the actual product)
| Path | What |
|---|---|
| `apps/web/` | The CRM you see at localhost:3000 |
| `apps/mobile/` | Placeholder — member app not started (just a README) |
| `supabase/` | Database schema + server functions (ready, not yet deployed anywhere) |
| `scripts/` | Schema test script |
| `package.json`, `pnpm-*`, `node_modules/`, `apps/web/.next/` | Plumbing/build artifacts — never touch |

### The only 4 docs at root
| Doc | One-liner |
|---|---|
| **README.md** | This page — current status lives here, always read first |
| **FEATURES.md** | Master feature checklist (✅ built / ⬜ not) — the single list of record |
| **DEPLOY.md** | Steps to go live — open when you decide to spend money |
| **CLAUDE.md** | Context file auto-loaded by Claude Code in VS Code |

### Reference (in `docs/` — history and background, not state; rarely needs opening)
| Doc | Read when |
|---|---|
| `docs/ROADMAP.md` · `docs/BUILD_PLAN.md` · `docs/GAP_AUDIT.md` | Planning history (FEATURES.md supersedes these as the list of record) |
| `docs/ARCHITECTURE.md` | Engineering reference (DB, security) |
| `docs/DECISIONS.md` | Open decisions + known issues |
| `docs/STACK_REVIEW.md` | Why these technologies (incl. why Supabase region = ca-central-1/Montréal) |
| `docs/COMPETITORS.md` | Sales/pricing questions |
| `docs/BUDGET.md` · `docs/FREE_TIER_PLAN.md` · `docs/CUSTOM_BUILD_PLAN.md` | Cost models |
| `docs/ONBOARDING.md` · `docs/MAINTENANCE.md` | When G1 signs |
| `docs/logs.md` | Raw meeting notes + Amir's feature list |
| `docs/oxround_company_structure_plan.md` · `docs/CRITIQUE_AND_PLAN.md` · PDFs | Founding history |

---

## How to run it

```bash
pnpm install   # once
pnpm dev       # then open localhost:3000
```

## How to ship changes

| What changed | Command(s) |
|---|---|
| App code (anything in `apps/`) | `git add -A && git commit -m "…" && git push` — Vercel auto-deploys in ~2 min |
| New file in `supabase/migrations/` | `supabase db push`, then the git commands |
| Files in `supabase/functions/` | `supabase functions deploy <name>`, then the git commands |

Unsure? `git status` — changes under `supabase/` need a supabase command; everything else is git-only.
