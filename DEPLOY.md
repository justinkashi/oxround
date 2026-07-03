# OxRound — Live Deployment Checklist

> Written 2026-07-03. Goal: demo at localhost:3000 → live CRM for the G1 owner + member app for members.
> Honest status first: the CRM's 4 demo-slice features are built and verified, but it has **no login/auth UI** (runs in demo mode), and the **member app is not scaffolded** (README placeholder only). Those are the two real work items — everything else is configuration.

Sequencing: **CRM live first (~1 week of work), member app second (~3–6 weeks).** The CRM alone already delivers owner value (members, payments, attendance, announcements); members check in with printed QR cards until the app ships.

---

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
