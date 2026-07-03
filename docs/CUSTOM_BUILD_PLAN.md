# OxRound — Custom-Build / Self-Host Plan (Replacing Every Paid Service With Code)

> Written 2026-07-03. For each paid service: what you'd build or self-host instead, the concrete implementation, and the founder-hours price. Two custom paths exist per service — **(A) self-host the open-source equivalent** (config work) and **(B) write it from scratch** (engineering work). Estimates assume one experienced full-stack founder.

---

## 0. Where custom code runs — the substrate

Everything below needs a server. Options:

| Substrate | Cost | Catch |
|---|---|---|
| **Oracle Cloud Always Free** (Ampere ARM) | $0 | Cut to 2 OCPU/12 GB in June 2026; aggressive idle-reclaim can shut instances down; capacity lottery at signup ([Oracle FAQ](https://www.oracle.com/cloud/free/faq/), [2026 review](https://space-node.net/blog/oracle-vps-free-tier-review-2026)). Fine for staging; **do not put the first customer's member database on a VM the vendor can reclaim.** |
| **Hetzner / OVH VPS** (4 vCPU, 8 GB) | ~$8–12/mo | Not free, but the honest substrate for a self-hosted production stack. |

Implementation baseline (once, ~1 day): Ubuntu LTS, Docker + Compose, Caddy (auto-TLS reverse proxy), UFW firewall, fail2ban, unattended-upgrades, SSH keys only.

---

## 1. Supabase ($25/mo) → self-host it, or rebuild its five services

### Path A — Self-host Supabase (it's open source)
Official Docker Compose stack; running in <15 min; minimum 4 GB RAM / 2 CPU ([Supabase self-hosting docs](https://supabase.com/docs/guides/self-hosting/docker)). All existing OxRound migrations, RLS policies, and Edge Functions work unchanged — zero application code rewritten.

You take over ([QueryGlow's honest limitations rundown](https://queryglow.com/blog/supabase-self-hosted)): OS/service patching, Postgres maintenance, backups & disaster recovery, monitoring, uptime. No dashboard orgs/branching; staging = a second full stack.

**Implementation:** `git clone supabase/supabase && cd docker && cp .env.example .env` → generate JWT secret + anon/service keys → `docker compose up -d` → point `NEXT_PUBLIC_SUPABASE_URL` at your VPS → `supabase db push` against it. Backups: nightly `pg_dump` cron to Cloudflare R2 (free) + weekly restore test.
**Effort:** ~2 days setup + **2–4 h/mo ops, forever.**

### Path B — From scratch (what Supabase actually gives you)

| Service | Custom build | Effort |
|---|---|---|
| Postgres | Postgres 16 in Docker; keep the exact same migrations | 0.5 day |
| Auth (JWT, OTP, sessions, refresh rotation, rate limiting) | Fastify/Hono API + `jose` + argon2 + OTP email flow | **2–3 weeks, security-critical** |
| Auto REST API (PostgREST) | Hand-written tRPC/REST endpoints per table; you also re-implement RLS as middleware since claims no longer flow to Postgres automatically | 2–4 weeks |
| Realtime (live check-in feed) | Postgres `LISTEN/NOTIFY` → `ws` WebSocket server | 3–5 days |
| Storage | MinIO (S3-compatible, OSS) or disk + signed URLs | 1–2 days |
| Edge Functions | Just routes on your API server | 0 (simpler than Deno deploy) |
| pg_cron | Stays — it's a Postgres extension | 0 |

**Path B total: 6–10 weeks.** Rebuilding auth from scratch is where startups get breached; PostgREST replacement also silently deletes your RLS story (ARCHITECTURE principle #4: isolation enforced by the database). **If you leave managed Supabase, Path A is the only sane custom path.**

## 2. Vercel ($20/mo) → Coolify or plain Docker on the VPS

**Path A — Coolify** (open-source, self-hosted Vercel-alike): git-push deploys, build pipeline, TLS, rollbacks. `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`, connect the GitHub repo, set env vars. ~half a day.
**Path B — plain:** `Dockerfile` for `apps/web` (`next build && next start`), GitHub Action that SSHes in, pulls, `docker compose up -d --build`; Caddy reverse-proxies app.oxround.com. ~half a day, fewer moving parts.
**What you lose:** preview deploys per PR, edge network (fine — customers are all in Quebec), zero-maintenance.

## 3. Expo EAS ($19–199/mo) → local builds + self-hosted OTA

- **Builds:** `eas build --local` on the founder's Mac produces the same artifacts free and unlimited; or full custom: Fastlane + Xcode/Gradle in GitHub Actions (~2 weeks to stabilize, BUDGET §7 already called it fragile). Recommendation: `--local`.
- **OTA updates:** `expo-updates` speaks an open protocol; a self-hosted update server is a static file layout + manifest endpoint — community reference implementations exist. Host manifests/bundles on Cloudflare R2 free. ~2–3 days.
- **App-store submission:** `fastlane deliver`/`supply` replaces EAS Submit. ~1 day.

## 4. Resend/Brevo → **do not custom-build email. This is the one hard no.**

Running your own Postfix/SMTP server is free in dollars and ruinous in practice: fresh IPs have no sending reputation, residential/VPS IP ranges are pre-blacklisted, and Gmail/Outlook will spam-folder the gym's membership-expiry emails silently. Deliverability is a reputation asset you cannot code. Every "self-hosted email" stack (Mailcow, Postal) still ends up relaying through a reputable provider.
**Custom path that works:** keep a free API tier (Brevo 300/day) and own the *queue* — you already do (`notifications` table + retry). $0 and zero deliverability risk.

## 5. Sentry ($26/mo) → GlitchTip self-hosted, or a 200-line custom logger

**Path A — GlitchTip** (OSS, Sentry-SDK-compatible): one Docker Compose service on the same VPS; point the existing Sentry SDK's DSN at it. ~2 h.
**Path B — custom:** global error handler → insert into an `app_errors` table → daily digest email + threshold alert (reuse the notification queue). ~1 day; you lose grouping, sourcemaps, release tracking. Fine at pilot volume.

## 6. PostHog → an `events` table (custom is actually better at your scale)

Self-hosted PostHog needs ClickHouse (8 GB+ RAM — oversized for you). **Custom:** `events(id, gym_id, user_id, name, props jsonb, created_at)` + a `track()` helper + SQL views charted on the existing dashboard pages. ~1–2 days, and the data lives beside your business data where the at-risk queries can join it. Genuinely the right call until ~20 gyms.

## 7. Stripe (2.9% + $0.30) → **cannot be custom-built. Full stop.**

Touching card numbers puts you in PCI DSS scope — vault audits, quarterly scans, liability. No startup self-builds card processing (gemini_ideas PDF said the same: "never build custom payment tokenization"). Custom-adjacent options: **Interac e-transfer + generated PDF invoices** (free, already the plan below 10 gyms) or open-source invoicing (Invoice Ninja self-hosted) if you want dunning automation without processing. Card-on-file subscriptions = Stripe/Square/Moneris, whenever that day comes.

## 8. Expo Push service → direct APNs + FCM (both are free Apple/Google services)

Expo's push relay is a convenience, not the transport. Custom: `firebase-admin` for FCM (Android) + `apns2`/JWT-signed HTTP/2 for APNs (iOS), token table you already have (`push_tokens`), send loop in the notification worker. ~3–4 days including dev-build config (`google-services.json`, APNs key). Removes the Expo-services dependency entirely — pairs well with §3.

## 9. Uptime monitoring → Uptime Kuma (OSS, self-hosted)

One Docker container, monitors app.oxround.com + check-in endpoint + the VPS itself, alerts to email/Telegram. ~1 h. (Monitor it from a *different* machine than the one it watches — e.g. a free Fly.io/Oracle micro instance — or the VPS dying takes the alarm with it.)

## 10. Cannot be coded around, period

Apple Developer Program **$99/yr** (TestFlight/App Store gate), Google Play **$25 once**, domain **~$12/yr**. Total unavoidable: **~$10/mo equivalent.**

---

## The two honest configurations

| | Managed (current plan) | Full self-host/custom |
|---|---|---|
| Cash | ~$35–55/mo | ~$10/mo (Oracle free, risky) or ~$20/mo (Hetzner) |
| Setup | ~1 day | ~1–2 weeks (Path A everywhere) |
| Ongoing ops | ~0 | **4–8 h/mo minimum** (patching, backups, upgrades, 2 a.m. incidents) |
| From-scratch variant | — | +2–3 months engineering before feature work resumes |

**The business-plan verdict, in one calculation:** full self-hosting saves ~$25–45/mo and costs ~5 h/mo of the technical founder — the same founder whose absence MAINTENANCE.md names as the #1 product-killing risk, during the exact 12 months the roadmap needs classes, booking, and the member app shipped. At the investor brief's own $75/h founder-hour figure, self-hosting is paying ~$375/mo to save ~$35/mo.

**What IS worth custom-building now** (cheap, no ops burden, improves the product):
1. §6 events table — better than PostHog at your scale, feeds the at-risk dashboard.
2. §5B error table + digest — a day, removes a service.
3. §9 Uptime Kuma — an hour.
4. §8 direct APNs/FCM — do it when the mobile app is built; removes Expo's push ceiling permanently.

**What is NOT, until ~$50k MRR** (BUDGET §7's original threshold, now with evidence): the database/auth layer (§1), hosting (§2), email (§4 — never), payments (§7 — never).
