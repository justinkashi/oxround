# OxRound — Live Deployment Checklist

> Written 2026-07-03; free-tier protocol added same day after the free-first decision.
> **What this file is:** the deployment RUNBOOK. You read it top-to-bottom when deploying and tick `[ ]` → `[x]` as you complete steps. Its *content* only changes when the deployment plan itself changes (e.g., Pro → free tier, or a new decision in docs/DECISIONS.md). It is NOT a status file — current phase always lives in README.md.

---

## FREE-TIER PROTOCOL (current path — decided 2026-07-03)

Runs the whole pilot at $0: Supabase Free (ca-central-1) + Vercel Hobby.
Known free-tier limits (accepted): Supabase pauses after **7 days of no database activity** (unpause manually in the dashboard) and has **no backups**; Vercel Hobby is **non-commercial only** — the moment G1 pays, upgrade to Vercel Pro ($20/mo) and consider Supabase Pro ($25/mo, backups + no pausing).

### Step 1 — GitHub (once)

- [x] 1.1 Repo pushed to GitHub as **private**. Verify no `.env*` file was ever committed (`.gitignore` already covers it): on github.com press `t` and type `.env` — nothing should appear.

### Step 2 — Supabase project (~20 min, all in the dashboard + terminal)

- [x] 2.1 supabase.com → **New project**. Name: `oxround`. **Region: Canada Central (ca-central-1)** — non-negotiable, Law 25 (docs/STACK_REVIEW.md R5). Plan: Free. Generate a strong database password and save it in your password manager — you'll need it in 2.3.
- [x] 2.2 Install the Supabase CLI on your Mac: `brew install supabase/tap/supabase` (or without Homebrew: `npm i -g supabase`). Then `supabase login` — opens your browser.
- [x] 2.3 In your terminal, at the repo root: `supabase link --project-ref <REF>` — the REF is the 20-character code in your project's URL (`supabase.com/dashboard/project/<REF>`). It asks for the database password from 2.1.
- [x] 2.4 `supabase db push` — applies all three migrations (schema + RLS + token hook). **Never run `seed.sql` on this project** — it contains demo check-in tokens.
- [x] 2.5 `supabase functions deploy check-in` — deploys the check-in Edge Function. (The `auth-hook` Edge Function is superseded by migration 0003's Postgres function — faster, no webhook secret. Don't deploy it; the folder stays in the repo as history.)
- [x] 2.6 Dashboard → **Authentication → Hooks** → **Customize Access Token (JWT) Claims** → Hook type: **Postgres** → schema `public`, function `custom_access_token_hook` → Create hook. ⚠️ Skipping this breaks everything silently: it's what puts `gym_id` + roles into the login token, and every RLS rule depends on it.
- [x] 2.7 Dashboard → **Storage** → create bucket `announcements` (toggle **Public** ON) and bucket `waivers` (Public OFF).
- [x] 2.8 Dashboard → **Authentication → Sign In / Providers** → Email: ON. Also turn **"Allow new users to sign up" OFF** (invite-only until the member app ships). ⚠️ The built-in email sender is 2 emails/hour AND only delivers to your own Supabase team's addresses — the G1 owner would never receive a login email. Custom SMTP (step 5.4) is therefore REQUIRED before anyone but you logs in.
- [x] 2.9 Dashboard → **Settings → API Keys**: copy the **Project URL** and the public key — the project has two interchangeable formats: legacy `anon` and modern `sb_publishable_…` (prefer the modern one). These are the two values Vercel will need later (safe to expose in a browser — the secret ones are `service_role` / `sb_secret_…`, never copy those anywhere).
- [x] 2.10 Pause prevention: put a weekly reminder in your phone to open the CRM (any real page-load of live data counts), or accept manually unpausing after idle weeks.

### Step 3 — Vercel (~10 min)

- [x] 3.1 vercel.com → **Add New… → Project** → Import the `oxround` GitHub repo.
- [x] 3.2 **Root Directory: `apps/web`** (it's a monorepo — this points Vercel at the Next.js app; it still auto-detects pnpm from the root lockfile). Framework preset: Next.js (auto). Leave build settings default.
- [x] 3.3 **Environment variables: add NONE for now.** No Supabase keys ⇒ the site runs in demo mode ⇒ you get a live, clickable, fake-data demo at a shareable URL. This is intentional: with the keys set, every page would show empty tables because the real login (Step 5) isn't built yet.
- [x] 3.4 Click **Deploy**. First build takes 2–3 min. You get `https://oxround-….vercel.app`.
- [x] 3.5 Smoke test the URL on your phone: dashboard, members, classes grid, a session roster, `/app` preview with the doors splash.

**🎉 Milestone: a shareable live demo.** Every `git push` to main now auto-deploys.

### Step 4 — Domain (REQUIRED before Step 5.4 — Resend can only email real recipients from a domain you own and verify)

- [ ] 4.0 Own `oxround.com` (or any domain). If not yet purchased: ~$15/yr at any registrar — the one unavoidable cost of this plan.
- [ ] 4.1 Vercel project → Settings → Domains → add `app.oxround.com` → add the CNAME record it shows you at your domain registrar. SSL is automatic. (Cosmetic — can wait for a booked G1 meeting.)

### Step 4.5 — Account security (10 min, do anytime before real data)

- [x] 4.5.1 Turn on two-factor authentication (2FA) on all three accounts: GitHub, Supabase, Vercel. These three accounts ARE the company — anyone who gets into one can take the product, the database, or the deployment.

### Step 5 — Real auth = the go-live gate (the remaining CODE work, ~3–5 days)

Everything above ships a demo. Real G1 data requires:

- [x] 5.1 Build B1 (below): magic-link login with `@supabase/ssr`, session guard on all pages, logout. The mock login page at `/login` is the UI starting point.
- [ ] 5.2 **Auth URL config (classic gotcha):** Supabase → Authentication → URL Configuration → set **Site URL** to your Vercel URL (later `app.oxround.com`) and add `http://localhost:3000/**` to **Redirect URLs**. Skip this and every magic-link email redirects to localhost — logins mysteriously fail for anyone but you.
- [ ] 5.3 Only then: add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel → Settings → Environment Variables (Production + Preview) → Redeploy.
- [ ] 5.4 **Custom SMTP (required — default sender won't email the owner). Resend account ✅ made.** In Resend: add + verify your sending domain (oxround.com) via the DNS records they show (needs the domain — Step 4). Create an API key. Then Supabase → Authentication → Emails → SMTP Settings → host `smtp.resend.com`, port 465, user `resend`, password = the API key, sender `no-reply@oxround.com`. Then raise the email rate limit (Authentication → Rate Limits) to ~30/hr.
- [ ] 5.5 Invite the G1 owner: Supabase → Authentication → Users → Invite user (his email). Then create the G1 gym row + his `gym_members` row with `roles={owner}` (prod-safe SQL: run `supabase/bootstrap-owner.sql` in the SQL editor — replace the email/name placeholders).
- [ ] 5.6 Verify AS HIM from the app (not the SQL editor): log in → add member → print QR → record payment → post announcement.
- [ ] 5.7 Law 25 minimum before real member data: privacy policy page linked in the footer + named privacy officer (you) + **sign the Supabase DPA** (Dashboard → Organization → Legal Documents — self-serve).
- [ ] 5.8 Free tier has NO backups. The moment real data exists, take a weekly manual backup: `supabase db dump -f backup-$(date +%F).sql` (keep the files somewhere outside the repo). ⚠️ This command needs Docker Desktop installed and running (it dumps via a container) — install it then, or ask Claude for a Docker-free alternative. Stops being needed at the Supabase Pro upgrade.

- [ ] 5.9 **Error monitoring (Sentry account ✅ made):** add `@sentry/nextjs` to `apps/web` (Claude does this — ~15 min), set the Sentry DSN as a Vercel env var. Then you see owner-facing crashes before he reports them. Pair with UptimeRobot (free) pinging the site + the check-in function.

> Note for later: when announcement **image uploads** are built, the Storage buckets will need their own access policies (buckets don't inherit table RLS). Not needed while uploads are unbuilt.

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

## Step 6 — One login → two apps (owner CRM + member web app) + end-to-end QR (current plan — D-19, ~1–2 weeks)

> Supersedes the native "Phase C" below for the pilot. One sign-in page routes by role: **owner/staff → CRM** (`/`), **member → member web app** (`/app`). The `/app` preview already has the member screens on shared demo data — this wires them to real per-member logins + data. The iPad check-in scanner is a tab inside the owner's CRM (no separate kiosk; the iPad is logged in as the gym, which sidesteps D-01). The verify-and-record `check-in` function is already deployed.
>
> **Reused, already built:** roles are already stamped into the login token (migration 0003 `custom_access_token_hook`); the `check-in` function; RLS scaffolding; the CRM auth/guard; the whole `/app` preview UI.

### 6A — One login, THREE destinations (role routing)
- [ ] 6A1. Member auth path: email magic-link/OTP login (reuse the CRM auth system already built), plus a "join gym" link so a new member's account links to G1.
- [ ] 6A2. Role router: after sign-in, read roles from the session → `owner`/`manager` → full CRM (`/`); `coach`/`receptionist` → **restricted CRM view** (D-21); `member` → member app (`/app`); none → "no access yet / contact your gym" screen.
- [ ] 6A3. Two-way guard (extends the existing guard `apps/web/src/proxy.ts`): a member who opens a CRM URL is bounced to `/app`; an owner who opens `/app` is allowed only as preview (decide: block vs allow). Staff-only pages stay staff-only.

### 6B — Owner / staff CRM side (same app, role-scoped — NOT a separate app)
- [ ] 6B1. Restrict all CRM pages to staff roles (guard currently checks "logged in," not "is staff").
- [ ] 6B2. **Per-role tab + action visibility (D-21):** owner/manager = everything; coach = schedule / their classes / rosters / mark attendance / scanner / member contact info — NO payments, plans, settings, reports; receptionist = the coach set + payments/check-in, no settings. One CRM, tabs and buttons shown by role.
- [ ] 6B3. Add a **Scanner** tab to the CRM nav → the iPad scanner page (6D). Available to owner/manager/coach/receptionist.

### 6C — Member web app side (`/app`, currently a preview)
- [ ] 6C1. Gate `/app` behind member login; per-member RLS so each member sees only their own bookings/QR/profile — never other members, never owner data.
- [ ] 6C2. Wire each preview screen (home, schedule, booking, profile) to the logged-in member's real data (not hardcoded "Marco").
- [ ] 6C3. **My QR tab**: renders that member's real check-in token as the QR. **Unpaid members (D-20): hide the QR, show "Payment due — see front desk."**
- [ ] 6C4. Booking/cancel writes to DB with capacity + waitlist.
- [ ] 6C5. PWA polish: Add-to-Home-Screen (icon, full-screen), keep-screen-awake while the QR is shown.
- [ ] 6C6. **Tab restructure (D-22):** new primary **MyOx** tab (streak, visits vs last month, milestone badges, motivational nudges — from existing check-in data); move **Schedule + booking under a "More" area** (with Profile/account); keep a "Book next class" shortcut on Home. Primary tabs → Home · MyOx · My QR · More.

### 6D — The QR scan, end-to-end (brain already deployed)
- [ ] 6D1. Scanner page in the CRM: opens the iPad camera, reads the member's on-screen QR, calls the deployed `check-in` function.
- [ ] 6D2. Result screen: "Welcome, Marco ✓" (green) / "Membership inactive ✗" / "Payment due ✗" (red). **Payment check is server-side in the `check-in` function (D-20) — the authoritative block; hiding the in-app QR is only a nudge.**
- [ ] 6D3. Hardening: ignore duplicate scans within 1 h.

### 6E — Prove it
- [ ] 6E1. Two real devices: member logs in on a phone → My QR tab → iPad (owner's CRM Scanner) reads it → member appears in the live feed + analytics.

Native iOS/Android apps: deferred to post-pilot (adds reliable push + store presence). Old native plan kept below for that stage.

---

## Phase C — Member app, NATIVE (DEFERRED to post-pilot per D-19; ~3–6 weeks when reached)

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
