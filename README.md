# OxRound — START HERE

**What this is:** B2B SaaS for boxing gyms — a web CRM for owners + a mobile app for members.
**First customer:** G1 Boxing (Vaudreuil-Dorion, QC).

---

## CURRENT STATUS — the only place this lives

> **Update this block + flip ✅/⬜ marks in FEATURES.md after every work session. Nothing else needs updating.**

- **Phase:** demo build-out COMPLETE (pre-deployment, $0). Nothing is deployed — no Supabase project, no Vercel.
- **Built:** full clickable CRM at `localhost:3000` — dashboard/live feed/at-risk, members, classes (weekly grid + rosters + waitlist), attendance analytics, payments, plans, leads Kanban, coaches, announcements, reports (+CSV), settings, login screen (mock) — plus phone-framed member-app preview at `/app` (doors splash, booking, QR). All demo-mode, in-memory data.
- **Decided sequence (2026-07-03):** 1) ✅ demo screens → 2) set up FREE-tier Supabase (ca-central-1) + FREE Vercel → 3) deploy. Free-tier caveats: Supabase free pauses after 7 days of inactivity + no backups; Vercel Hobby is non-commercial only — must move to Pro when G1 starts paying.
- **Next:** show G1 the demo, then DEPLOY.md (free-tier track). Real auth (B1) is the main code work at deployment.
- **Fixed 2026-07-03:** lockfile synced to Next 16; `typescript` pinned to a real version (^5.9.3). `pnpm install` once and you're current.
- **Last updated:** 2026-07-03 (demo build-out: 11 new screens; docs reorganized — root = README/FEATURES/DEPLOY/CLAUDE, rest in `docs/`).

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
