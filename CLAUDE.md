# OxRound — context for Claude

B2B SaaS for boxing gyms: web CRM for owners (`apps/web`) + member mobile app (`apps/mobile`, not started). First customer: G1 Boxing (Vaudreuil-Dorion, QC). The founder is a non-engineer — explain in plain language, keep answers short, don't create new planning documents.

## Read first, in this order
1. `README.md` — CURRENT STATUS block at top = the single source of truth for what phase we're in.
2. `FEATURES.md` — master feature checklist (✅ built / ⬜ not). The single list of record.
3. Only then the specific files being changed. Do NOT re-read the whole repo or the `docs/` folder.

## After any feature work
Flip the matching ⬜→✅ in `FEATURES.md` and refresh the CURRENT STATUS block in `README.md`. That is the entire state-update ritual.

## Stack (why: docs/STACK_REVIEW.md)
- pnpm monorepo; Next 16 + React 19 + Tailwind 3 in `apps/web`; TypeScript strict.
- Supabase (Postgres + Auth + Edge Functions) — region must be `ca-central-1` (Montréal, Law 25). Migrations in `supabase/migrations`, functions `check-in` + `auth-hook` in `supabase/functions`. NOT deployed yet.
- Multi-tenant via RLS; `auth-hook` injects `gym_id` + roles into JWT — RLS depends on it.
- Member app (later): Expo SDK 55, dev builds, NativeWind, email OTP.

## Conventions
- Data layer = `apps/web/src/lib/data.ts`: every function has a demo-mode branch (in-memory, `isDemoMode`) and a Supabase branch. New features must keep this pattern until deployment.
- Member archive = soft-delete only, never hard delete. Check-in tokens: SHA-256 hash stored, raw token shown/printed once.
- Static-export compat: dynamic pages use query params (`/members/view?id=`), not route params.
- `docs/` = reference/history only, never state. Don't edit unless asked.

## Known issues
- `pnpm-lock.yaml` may lag `package.json` — if build fails, `pnpm install` first.
- Kiosk JWT minting flow undecided (docs/DECISIONS.md D-01) — don't build kiosk deployment before it.
