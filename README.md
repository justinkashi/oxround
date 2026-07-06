# OxRound — START HERE

**What this is:** B2B SaaS for boxing gyms — a web CRM for owners + a mobile app for members.
**First customer:** G1 Boxing (Vaudreuil-Dorion, QC).

---

## CURRENT STATUS — the only place this lives

> **Update this block + flip ✅/⬜ marks in FEATURES.md after every work session. Nothing else needs updating.**

- **Phase:** LIVE (real auth in production). Supabase project `oxround` (ref `ymhbsvjqklqtfcitonzs`, ca-central-1): all 6 migrations applied, edge functions `check-in` + `auth-hook` + `invite-member` all ACTIVE, token hook + buckets + Resend SMTP configured. Magic-link login works end-to-end; the owner lands in the real CRM. NOTE: "demo mode" is only the automatic fallback that kicks in when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are unset (e.g. running `pnpm dev` locally with no `.env`) — it is NOT the state of the deployed site.
- **Built:** full clickable CRM (dashboard/live feed/at-risk, members, classes grid + rosters + waitlist, attendance, payments, plans, leads Kanban, coaches, announcements, reports+CSV, settings, mock login) + member-app preview at `/app` + responsive pass (mobile nav, stacking layouts, scrollable tables — desktop unchanged).
- **DEPLOY.md status:** Steps 1–3 ✅, 4.5 (2FA) ✅, 5.1 (real auth CODE) ✅ built & verified — magic-link login, session guard (`apps/web/src/proxy.ts`), logout, `/auth/callback`, owner bootstrap SQL at `supabase/bootstrap-owner.sql`. Pending: 4.0 domain purchase (Resend prerequisite), 5.2–5.8 (config + owner onboarding).
- **AUTH LIVE (2026-07-05):** real magic-link login working end-to-end on production — owner logs in, lands in real (empty) CRM. Domain `oxround.com` on Cloudflare; `app.oxround.com`→Vercel (propagating); Resend verified, Supabase SMTP live (emails send from no-reply@oxround.com, 30/hr).
- **Step 6 core BUILT (2026-07-05, verified compiling):** role routing + staff/member guard (6A), role-scoped CRM nav (6B), member web app on real data — Home/MyOx/MyQR/More, real QR gated by payment (6C, D-20, D-22), iPad `/scanner` QR check-in (6D), owner notification bell (6F partial), new-member starts unpaid/pending (6G/D-24 data side).
- **Step 6 messaging/community/invite BUILT (2026-07-05):** `messages` table + RLS (migration 0005, applied live), CRM `/messages` (1:1 reply + broadcast), member app Community tab (feed + message the gym), `invite-member` Edge Function (emails activation link + links account — NEEDS DEPLOY: `supabase functions deploy invite-member` + secret `APP_URL`). Grace period default = 7 days (`GRACE_PERIOD_DAYS`).
- **Step 6 REMAINING:** message-unread counts on the bell + member push; grace-period auto-timer (needs billing dates). Lockfile fixed (pglite leak removed) — Vercel build passes.
- **TO DEPLOY:** `git push` (code + migration files), then `supabase functions deploy invite-member` and `supabase secrets set APP_URL=<your vercel/app url>`.
- **Decided not yet built (D-19/D-21):** ONE login routes by role — owner/manager→full CRM, coach/receptionist→restricted CRM view (same app), member→`/app` web app; CRM gets a Scanner tab, member app gets a My QR tab; full end-to-end QR check-in. Native apps later. Full checklist = DEPLOY.md Step 6.
- **Accounts ready:** Sentry ✅ + Resend ✅ made (wiring in DEPLOY 5.4 + 5.9). Domain still to buy.
- **Last updated:** 2026-07-05 (Members: CSV bulk-import wizard added; notification-bell dropdown no longer clips on desktop; Phase note corrected — production is real auth, not demo. Confirmed live: 6 migrations applied + invite-member ACTIVE, so adding a member auto-provisions the login + emails the activation link, no Supabase console needed. Prior: login page Member/Coach/Owner tabs — cosmetic, server routes by real role.)

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
