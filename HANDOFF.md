# OxRound — session handoff (2026-07-05)

Short note so anyone (or another Claude on the co-founder's account) can pick up. Full plan lives in `DEPLOY.md` (Step 6) + `docs/DECISIONS.md` (D-01…D-24). Read `CLAUDE.md` → `README.md` → `FEATURES.md` first.

## Where we are
- **Deployed** on Vercel (`oxround-web.vercel.app`) + Supabase (`ymhbsvjqklqtfcitonzs`, ca-central-1), free tier.
- **Real auth built + FIXED.** Login = magic link → server-side exchange at `/auth/confirm`. The token-hook bug (`auth_roles() does not exist`) is fixed by migration `00000000000004` (already applied live + verified: returns `roles:[owner]`).
- **Login is proven working at the DB level** — only blocker to actually logging in was Supabase's 2-emails/hour cap on the built-in sender (temporary; resets hourly). Built-in sender DOES reach justin.kashi@hotmail.com.
- Owner test account: `justin.kashi@hotmail.com`, made owner via `supabase/bootstrap-owner.sql`.

## ⚠️ Un-pushed as of this handoff — PUSH FIRST
```
git add -A && git commit -m "auth fixes + Step 6 specs" && git push
```
Includes: `/auth/confirm/route.ts`, rewritten `login/page.tsx`, `proxy.ts`, migration `0004`, and doc updates (DECISIONS D-19…D-24). Migration 0004 is already applied to the live DB; pushing just keeps git in sync.

## Secrets NOT in the repo (share securely)
- Supabase Project URL: `https://ymhbsvjqklqtfcitonzs.supabase.co`
- Supabase publishable key: `sb_publishable_UiyRm2Fro-r42yVVEmmfNw_8AAtzo7N` (public, safe)
- Resend API key: made (in Resend dashboard) — **rotate it, it was shown on screen**
- Sentry DSN: in Sentry project settings (not yet grabbed)
- `service_role` / `sb_secret_…`: never share, never commit

## Immediate next steps
1. Push (above).
2. Wait for the email cap to reset → log in at `oxround-web.vercel.app` with the hotmail (one link, same browser). Confirms auth end-to-end.
3. Buy domain (later today) → then wire Resend SMTP in Supabase (DEPLOY 5.4) so real members/owner can receive emails.
4. Then build **Step 6** (DEPLOY.md): one login → role router (owner/manager→CRM, coach/receptionist→restricted CRM per D-21, member→`/app`); member web app on real data; My QR + iPad scanner; D-20 unpaid-no-QR (with grace + owner notification); D-22 MyOx tab; D-23 messaging(two-way+broadcast)/community/notification bell; D-24 invite→join→activate onboarding.

## Decisions locked today (see docs/DECISIONS.md)
- D-19 member app = website/PWA first, native later.
- D-20 unpaid loses QR, but with a grace period + owner gets notified.
- D-21 coach/receptionist = role-scoped CRM view (default matrix confirmed).
- D-22 member app: add MyOx engagement tab, move Schedule under "More".
- D-23 messaging two-way 1:1 + broadcast; Community tab; notification bell (also carries system alerts: owner at-risk/overdue, member class reminders).
- D-24 add member → Invited (email link) → Joined-unpaid (app access, no QR, inactive) → Active on owner payment confirm.

## Still needs founder/G1 business input
- D-16 in-app payment pricing model (blocks Stripe build).
- D-20 exact grace-period length (default 7 days).

## Env / tooling notes
- pnpm monorepo, Next 16. If build fails: `pnpm install` first (lockfile can lag).
- Ship changes: app code → `git push` (Vercel auto-deploys). DB → new file in `supabase/migrations` + `supabase db push`. Edge functions → `supabase functions deploy`.
- MCP connections (Supabase/Vercel) are per-session — the co-founder reconnects their own in Cowork.
