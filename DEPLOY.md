# OxRound — Live Deployment Checklist

> Written 2026-07-03; free-tier protocol added same day after the free-first decision.
> **What this file is:** the deployment RUNBOOK. You read it top-to-bottom when deploying and tick `[ ]` → `[x]` as you complete steps. Its *content* only changes when the deployment plan itself changes (e.g., Pro → free tier, or a new decision in docs/DECISIONS.md). It is NOT a status file — current phase always lives in README.md.

---

## FREE-TIER PROTOCOL (current path — decided 2026-07-03)

Runs the whole pilot at $0: Supabase Free (ca-central-1) + Vercel Hobby.
Known free-tier limits (accepted): Supabase pauses after **7 days of no database activity** (unpause manually in the dashboard) and has **no backups**; Vercel Hobby is **non-commercial only** — the moment G1 pays, upgrade to Vercel Pro ($20/mo) and consider Supabase Pro ($25/mo, backups + no pausing).

### Step 1 — GitHub (once)

- [ ] 1.1 Repo pushed to GitHub as **private**. Verify no `.env*` file was ever committed (`.gitignore` already covers it): on github.com press `t` and type `.env` — nothing should appear.

### Step 2 — Supabase project (~20 min, all in the dashboard + terminal)

- [ ] 2.1 supabase.com → **New project**. Name: `oxround`. **Region: Canada Central (ca-central-1)** — non-negotiable, Law 25 (docs/STACK_REVIEW.md R5). Plan: Free. Generate a strong database password and save it in your password manager — you'll need it in 2.3.
- [ ] 2.2 Install the Supabase CLI on your Mac: `brew install supabase/tap/supabase` (or without Homebrew: `npm i -g supabase`). Then `supabase login` — opens your browser.
- [ ] 2.3 In your terminal, at the repo root: `supabase link --project-ref <REF>` — the REF is the 20-character code in your project's URL (`supabase.com/dashboard/project/<REF>`). It asks for the database password from 2.1.
- [ ] 2.4 `supabase db push` — applies all three migrations (schema + RLS + token hook). **Never run `seed.sql` on this project** — it contains demo check-in tokens.
- [ ] 2.5 `supabase functions deploy check-in` — deploys the check-in Edge Function. (The `auth-hook` Edge Function is superseded by migration 0003's Postgres function — faster, no webhook secret. Don't deploy it; the folder stays in the repo as history.)
- [ ] 2.6 Dashboard → **Authentication → Hooks** → **Customize Access Token (JWT) Claims** → Hook type: **Postgres** → schema `public`, function `custom_access_token_hook` → Create hook. ⚠️ Skipping this breaks everything silently: it's what puts `gym_id` + roles into the login token, and every RLS rule depends on it.
- [ ] 2.7 Dashboard → **Storage** → create bucket `announcements` (toggle **Public** ON) and bucket `waivers` (Public OFF).
- [ ] 2.8 Dashboard → **Authentication → Sign In / Providers** → Email: ON. Note: the built-in email sender is rate-limited to a few emails/hour — fine while only the owner logs in; switch to Resend SMTP before members use email login.
- [ ] 2.9 Dashboard → **Settings → API** (or **Settings → API Keys**): copy the **Project URL** and the **anon/public key** somewhere safe. These are the two values Vercel will need later (they're safe to expose in a browser — the secret one is `service_role`, never copy that anywhere).
- [ ] 2.10 Pause prevention: put a weekly reminder in your phone to open the CRM (any real page-load of live data counts), or accept manually unpausing after idle weeks.

### Step 3 — Vercel (~10 min)

- [ ] 3.1 vercel.com → **Add New… → Project** → Import the `oxround` GitHub repo.
- [ ] 3.2 **Root Directory: `apps/web`** (it's a monorepo — this points Vercel at the Next.js app; it still auto-detects pnpm from the root lockfile). Framework preset: Next.js (auto). Leave build settings default.
- [ ] 3.3 **Environment variables: add NONE for now.** No Supabase keys ⇒ the site runs in demo mode ⇒ you get a live, clickable, fake-data demo at a shareable URL. This is intentional: with the keys set, every page would show empty tables because the real login (Step 5) isn't built yet.
- [ ] 3.4 Click **Deploy**. First build takes 2–3 min. You get `https://oxround-….vercel.app`.
- [ ] 3.5 Smoke test the URL on your phone: dashboard, members, classes grid, a session roster, `/app` preview with the doors splash.

**🎉 Milestone: a shareable live demo.** Every `git push` to main now auto-deploys.

### Step 4 — Domain (optional now, 15 min when ready)

- [ ] 4.1 Vercel project → Settings → Domains → add `app.oxround.com` → add the CNAME record it shows you at your domain registrar. SSL is automatic.

### Step 5 — Real auth = the go-live gate (the remaining CODE work, ~3–5 days)

Everything above ships a demo. Real G1 data requires:

- [ ] 5.1 Build B1 (below): magic-link login with `@supabase/ssr`, session guard on all pages, logout. The mock login page at `/login` is the UI starting point.
- [ ] 5.2 Only then: add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel → Settings → Environment Variables (Production + Preview) → Redeploy.
- [ ] 5.3 Invite the G1 owner: Supabase → Authentication → Users → Invite user (his email). Then create the G1 gym row + his `gym_members` row with `roles={owner}` (prod-safe SQL, no seed.sql).
- [ ] 5.4 Verify AS HIM from the app (not the SQL editor): log in → add member → print QR → record payment → post announcement.
- [ ] 5.5 Law 25 minimum before real member data: privacy policy page linked in the footer + named privacy officer (you).

### Upgrade triggers (when free stops being correct)

| Trigger | Action |
|---|---|
| G1 starts paying you | Vercel Hobby → Pro ($20/mo) — ToS requirement, same day |
| Real member PII in the DB | Supabase Free → Pro ($25/mo) — backups + no pausing |
| Members log in by email | Resend SMTP (free tier) replaces built-in sender |

---

## Original Pro-tier plan (reference — superseded for the pilot by the protocol above; the B/C/D phases below still apply when you reach them)

## Phase A — Backend live (half a day, config only)

- [ ] A1. Create Supabase **Pro** project in **`ca-central-1`** (STACK_REVIEW). Sign the DPA (Law 25), file a copy.
- [ ] A2. `supabase link --project-ref <ref>` then `supabase db push` — applies migrations 0001 + 0002. Do NOT run seed.sql in prod (it contains demo tokens); create the G1 gym row manually or via a prod-safe seed.
- [ ] A3. Create Storage buckets: `announcements` (public-read), `waivers` (private).
- [ ] A4. Deploy Edge Functions: `supabase functions deploy check-in auth-hook`. Set secrets (`supabase secrets set`). Enable `auth-hook` as the **Custom Access Token hook** in Auth settings (this injects gym_id + roles — RLS depends on it).
- [ ] A5. Auth config: enable email provider; magic link for CRM; custom SMTP via Resend (default Supabase SMTP is rate-limited to ~2/hr).

## Phase B — CRM live (the real work: ~3–5 days)

- [ ] B1. **Build auth into the CRM** — login page (magic link), session handling via `@supabase/ssr`, route guard on all pages, logout. This is the only missing feature blocking go-live.
- [ ] B2. Production-mode data layer: member creation generates raw token client-side → shows/prints QR **once** → stores SHA-256 only (already coded in `data.ts`, needs the print dialog). Gate demo mode behind `NODE_ENV !== 'production'`.
- [ ] B3. `pnpm install` at repo root — **lockfile is stale**: it pins Next 14 from the pre-upgrade install; package.json targets Next 16. Reinstall, then `pnpm build` to verify locally.
- [ ] B4. Push repo to GitHub (private). Confirm `.env*` never committed (.gitignore already covers).
- [ ] B5. Vercel: import repo, root directory `apps/web`, set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (prod + preview). Deploy.
- [ ] B6. Domain: `app.oxround.com` → Vercel (CNAME). SSL automatic.
- [ ] B7. Create owner account: invite G1 owner's email via Supabase Auth, insert his `gym_members` row with `roles={owner}` linked to the G1 gym row. Log in as him once to verify JWT claims + RLS (test from the app, not the SQL editor).
- [ ] B8. Monitoring: Sentry (free Developer tier per STACK_REVIEW) in `apps/web`; UptimeRobot on app.oxround.com + the check-in function.
- [ ] B9. Law 25 minimum: publish privacy policy page (footer link); note the designated privacy officer; data export/delete can be manual (email request) at pilot scale, but the policy must say how.
- [ ] B10. Real data entry: ONBOARDING.md Type A/B session with the owner (2–3 h together — do it with him, not for him to do). Print the QR card sheet for all members.

**CRM go-live gate:** owner logs in on his own laptop → adds a member → prints QR → marks payment → deactivates a test member → posts an announcement. All on app.oxround.com.

## Phase C — Member app (Stage 2: ~3–6 weeks)

Backend prerequisites (member app is useless without schedule data):
- [ ] C1. Classes + sessions: CRM class management page, session generation (pg_cron weekly), schedule API.
- [ ] C2. Bookings: book/cancel/waitlist Edge Function with capacity enforcement; no-show auto-mark.

The app itself:
- [ ] C3. Scaffold: `npx create-expo-app@latest mobile` (SDK 55, dev builds — not Expo Go). NativeWind, Expo Router, expo-secure-store.
- [ ] C4. Auth: **email OTP** (D-08), join-gym via invite code.
- [ ] C5. Screens: home (next class + announcements), schedule + booking, **my QR** (full-screen), profile, announcement detail. Splash: owner-photo doors animation (logs.md).
- [ ] C6. Push: expo-notifications, upsert `push_tokens` on login, `notify-broadcast` Edge Function wired to announcement creation.
- [ ] C7. Kiosk: `kiosk.tsx` camera screen (expo-camera) + **build the kiosk JWT minting flow (D-01 — still pending; no kiosk deployment before this)** + Guided Access setup on the gym iPad.
- [ ] C8. Accounts: Apple Developer ($99/yr — start now, verification takes days) + Google Play ($25 one-time).
- [ ] C9. EAS Build → **TestFlight internal distribution** for the pilot (per ARCHITECTURE §15: TestFlight first, public stores month 2). Android: internal testing track or APK sideload on the kiosk tablet.
- [ ] C10. Member activation per ONBOARDING.md: invite emails with store deep links, app day at the gym, QR cards remain the fallback.

## Phase D — Hardening (parallel with C, before calling it "live")

- [ ] D1. GitHub Actions CI: typecheck + build + `validate-migrations.mjs` on PR; Vercel handles deploy previews.
- [ ] D2. Run MAINTENANCE.md's 10-point regression checklist before every binary release.
- [ ] D3. Verify a Supabase backup restore once (Pro = daily backups, 7-day retention).
- [ ] D4. Support channel: support@oxround.com + owner's WhatsApp thread; SLAs per MAINTENANCE.md.

---

## Cost delta when live

Supabase Pro $25 + Vercel Pro $20 + Apple $8.25/mo amortized + domain ≈ **$55/mo** (Sentry/Resend/EAS free tiers at pilot scale). Matches STACK_REVIEW's revised Tier-0 estimate.
