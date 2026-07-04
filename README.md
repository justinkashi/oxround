# OxRound — START HERE

**What this is:** B2B SaaS for boxing gyms — a web CRM for owners + a mobile app for members.
**First customer:** G1 Boxing (Vaudreuil-Dorion, QC).

---

## CURRENT STATUS — the only place this lives

> **Update this block + flip ✅/⬜ marks in FEATURES.md after every work session. Nothing else needs updating.**

- **Phase:** DEPLOYED (free tier, demo mode). Live at the Vercel URL; Supabase project `oxround` in ca-central-1 with all 3 migrations, token hook, buckets, email provider configured. No env vars on Vercel yet — site intentionally runs demo mode until real auth exists.
- **Built:** full clickable CRM (dashboard/live feed/at-risk, members, classes grid + rosters + waitlist, attendance, payments, plans, leads Kanban, coaches, announcements, reports+CSV, settings, mock login) + member-app preview at `/app` + responsive pass (mobile nav, stacking layouts, scrollable tables — desktop unchanged).
- **DEPLOY.md status:** Steps 1–3 ✅, 4.5 (2FA) ✅, 5.1 (real auth CODE) ✅ built & verified — magic-link login, session guard (`apps/web/src/proxy.ts`), logout, `/auth/callback`, owner bootstrap SQL at `supabase/bootstrap-owner.sql`. Pending: 4.0 domain purchase (Resend prerequisite), 5.2–5.8 (config + owner onboarding).
- **Next:** push auth code → Supabase URL config (5.2) → Vercel env vars (5.3) → test login with own email → domain + Resend (5.4) → invite G1 owner.
- **Last updated:** 2026-07-04 (real auth built; deployed + responsive earlier same day).

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
