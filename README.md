# OxRound — START HERE

**What this is:** B2B SaaS for boxing gyms — a web CRM for owners + a mobile app for members.
**First customer:** G1 Boxing (Vaudreuil-Dorion, QC).

---

## Where we are (2026-07-03)

1. ✅ **Planning done.** Features, pricing, competitors, costs, deployment — all documented (map below).
2. ✅ **Working CRM prototype** runs on your laptop at `localhost:3000` (run `pnpm dev`). Members, payments, check-in logs, at-risk dashboard, announcements — on fake sample data, no login, costs $0.
3. ⏳ **Current step (decided, not started):** build the *remaining* screens — CRM classes/booking/coaches/payments/settings, and a phone-styled member-app preview at `localhost:3000/app` — still $0, still on your laptop.
4. ⬜ **After that:** show G1 → then go live (~$35/mo: real database, login, app.oxround.com) → then the real iPhone/Android app.

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

### Documents — read in this order if lost
| Doc | One-liner | Read when |
|---|---|---|
| **README.md** | This page | Always first |
| **ROADMAP.md** | What's in MVP vs later phases | Before any feature talk |
| **BUILD_PLAN.md** | Every feature we've ever listed + build order | "What are we building?" |
| **GAP_AUDIT.md** | Everything NOT built yet, exhaustive | "What's missing?" |
| **DEPLOY.md** | Steps to go live when ready | When you want to spend money |
| ARCHITECTURE.md | Technical reference (DB, security) | Engineering only |
| DECISIONS.md | Open decisions + known issues | Start of work sessions |
| COMPETITORS.md | Mindbody/Zen Planner etc. analysis | Sales/pricing questions |
| BUDGET.md · FREE_TIER_PLAN.md · CUSTOM_BUILD_PLAN.md | Cost models: paid / free / self-built | Money questions |
| STACK_REVIEW.md | Why these technologies | Once, or never |
| ONBOARDING.md · MAINTENANCE.md | How to onboard gyms / run ops | When G1 signs |
| logs.md | Your raw meeting notes + Amir's feature list | Reference |
| reddit_fitness_crm_research.md | One saved Reddit link | Reference |
| `archive/` | Old founding docs (investor brief, critiques) | History only |

### Safe to delete (leftover junk)
- `demo-static/` folder and `oxround-demo-static.zip` — a packaged copy of the prototype you said you don't need
- `_tmp_9_8127ad5fbb0d0684823c9289bcb98b66` and `_tmp_9_ddf66e367b5c1058ca047e371ef3292f` — empty temp files from a failed install

---

## How to run it

```bash
pnpm install   # once
pnpm dev       # then open localhost:3000
```
