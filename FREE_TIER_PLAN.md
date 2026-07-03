# OxRound — Free Alternative for Every Paid Service

> Written 2026-07-03. For each paid service in the stack (BUDGET.md / DEPLOY.md): the free alternative, how to implement it, what breaks, and when the paid tier becomes unavoidable.
> Bottom line: a ToS-compliant $0/mo software stack exists. The only unavoidable costs are the Apple Developer Program ($99/yr) and the domain (~$12/yr) → **~$10/mo effective**. The one paid service worth keeping anyway is Supabase Pro at go-live, for backups of real customer data.

---

## 1. Supabase Pro ($25/mo) → Supabase Free tier

**Free tier (verified 2026):** 500 MB database, 1 GB storage, 5 GB egress, 50K MAU auth, 500K Edge Function calls, 200 realtime connections, 2 projects ([Supabase pricing](https://supabase.com/pricing), [UI Bakery breakdown](https://uibakery.io/blog/supabase-pricing)). At pilot scale (1 gym, ~10 MB data/yr) every quota is 50–500x more than needed.

**The two real limitations and their implementations:**
1. **Pauses after 7 days of DB inactivity** ([pause guide](https://shadhujan.medium.com/how-to-keep-supabase-free-tier-projects-active-d60fd4a17263)). A live gym generates daily check-ins, so pause risk is near zero once G1 is active. Pre-launch mitigation: a `pg_cron` job inserting a daily row into `cron_job_log` (already in the schema) resets the timer.
2. **No automated backups** (Pro has daily, 7-day retention). Mitigation: nightly `pg_dump` via GitHub Actions (free minutes) pushed to a private repo or Cloudflare R2 free tier:
   ```yaml
   # .github/workflows/backup.yml — runs 03:00 UTC daily
   - run: pg_dump "$SUPABASE_DB_URL" | gzip > backup-$(date +%F).sql.gz
   ```
**Verdict:** Free for dev/staging and demo, no argument. At go-live with real member PII, $25/mo for managed backups + no-pause is the single best paid dollar in the stack — a lost member database ends the G1 relationship. **Recommend: this is the one to pay for.**

## 2. Vercel Pro ($20/mo) → Cloudflare Workers/Pages free (NOT Vercel Hobby)

**Critical:** Vercel's Hobby (free) plan prohibits commercial use — any deployment for financial gain requires Pro ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines), [Hobby plan docs](https://vercel.com/docs/plans/hobby)). A paid CRM on Hobby violates ToS; do not do it.

**Legitimate free alternative: Cloudflare Workers** (free plan permits commercial use; 100K requests/day). Implementation: deploy Next.js via the `@opennextjs/cloudflare` adapter — `pnpm add @opennextjs/cloudflare`, add `wrangler.jsonc`, `pnpm dlx opennextjs-cloudflare build && wrangler deploy`. Custom domain (app.oxround.com) free via Cloudflare DNS. Trade-offs: adapter maintenance on Next.js major upgrades, no zero-config preview deploys, some Next features (ISR, image optimization) need config.

**Verdict:** genuinely free and compliant. $20/mo Vercel buys zero-config deploys + previews; a fair trade only if founder-hours are the scarcer resource (they are, per Investor Brief R7). Either is defensible — Cloudflare if cash-constrained.

## 3. Expo EAS (Starter $19 / Production $199) → EAS Free + local builds

Already free at pilot: 15 iOS + 15 Android cloud builds/mo, OTA updates to 1,000 MAU ([Expo plans](https://docs.expo.dev/billing/plans/)). G1 ≈ 80 app users → 8% of the free OTA quota.

**When outgrown (~1,400 users, ≈ 15+ gyms):**
- Builds: `eas build --local` on the founder's Mac (free, unlimited) or GitHub Actions + Fastlane (BUDGET §7: ~2 weeks setup, fragile).
- OTA: `expo-updates` supports a fully self-hosted update server — static files on Cloudflare R2/Pages (free) implementing the updates protocol.

**Verdict:** free tier suffices through the entire 12-month plan (10 gyms ≈ 800 users). Revisit at 15+ gyms; $19 Starter will be trivially affordable by then.

## 4. Resend Pro ($20/mo, Phase 2) → Brevo free tier

**Brevo: 300 emails/day (~9,000/mo) free forever, full API** ([Brevo comparison](https://www.brevo.com/blog/best-transactional-email-services/), [Mailtrap comparison](https://mailtrap.io/blog/transactional-email-services/)) vs Resend free's 3,000/mo with a 100/day cap — the cap that a single 80-member announcement blast nearly exhausts. AWS SES ($0.10/1K) is cheaper at scale but its free tier lasts only 12 months and setup (IAM, CloudWatch, reputation dashboards) costs founder-hours.

**Implementation:** SPF + DKIM records for oxround.com in Cloudflare DNS; swap the send call in the notification Edge Function (`fetch("https://api.brevo.com/v3/smtp/email", ...)`); keep templates as plain HTML (React Email is Resend-specific).

**Verdict:** real free win. 300/day covers ~3 full-gym email blasts daily at pilot. Upgrade trigger: ~5+ gyms with email-backed announcements (~$15–25/mo at Brevo/Resend paid, equivalent).

## 5. Sentry Team ($26/mo) → Sentry Developer free

1 user, 5K errors/mo — enough for pilot volume. Implementation: technical founder owns the account; add a Sentry → email/Slack alert rule so the second founder sees P1s (workaround for the 1-user limit, per BUDGET §2 note). Self-hosted GlitchTip is the "fully free" option but needs a server — only free on something like Oracle Cloud's free VM, which adds an ops burden that violates stack rule R1.

**Verdict:** Developer free until first paying gym (already the STACK_REVIEW plan); Team $26 when two people genuinely need dashboard access.

## 6. PostHog (usage-based) → PostHog free tier

1M events/mo free ≈ ~120 gyms at realistic volumes (CRITIQUE corrected BUDGET's estimate). No action; don't instrument until Phase 2 anyway.

## 7. Stripe (2.9% + $0.30 per invoice) → Interac e-transfer for OxRound's own billing

At pilot, OxRound invoices 1–10 gyms/mo. Free implementation: monthly PDF invoice (generate from a template) emailed to the owner + Interac e-transfer with autodeposit to the business account — $0–1.50 bank fee vs $4.62 Stripe fee on a $149 invoice. This is exactly how the gyms themselves operate, so owners find it normal.

**Verdict:** free and appropriate below ~10 gyms. Switch to Stripe Billing when manual invoicing costs >1 founder-hour/mo (~10+ gyms) — dunning and card-on-file are worth 3% at that point. (Gym-to-member payments are unaffected — that's Phase 3 Stripe Connect, D-16.)

## 8. GitHub Team ($8/mo) → GitHub Free

Free plan: unlimited private repos, unlimited collaborators, 2,000 Actions minutes/mo (covers CI + the nightly backup job). Team adds protected-branch rules and required reviewers — nice, not needed for 2 founders.

**Verdict:** free, zero downside now. BUDGET.md's $8 line can be deleted.

## 9. Apple Developer Program ($99/yr) → **no free alternative exists**

TestFlight and App Store distribution require the paid program. Free dev-signing installs expire after 7 days and cap at 3 devices — unusable for members. **Must pay.** (Enrollment takes days; start early per DEPLOY C8.)

## 10. Google Play ($25 one-time) → sideloaded APK

Technically free: distribute the Android APK directly (kiosk tablet especially — sideloading the kiosk build is standard practice and saves nothing by avoiding, since $25 is one-time). **Verdict: pay the $25;** sideload only the kiosk device.

## 11. Domain (~$12/yr) → *.pages.dev / *.vercel.app subdomain

Free but reads as unfinished to a paying customer and breaks email deliverability (no custom SPF/DKIM domain). **Keep the domain** — it's $1/mo.

## 12. Already free / future services

- **Cloudflare DNS/CDN, UptimeRobot** (50 monitors free) — already free in the plan.
- **Twilio SMS OTP** (future) — avoided entirely by email OTP (D-08), which is free via Supabase Auth + Brevo SMTP.
- **Kiosk hardware** — owner's existing iPad, $0 (D-17).

---

## Summary table

| Paid service | Free alternative | Real cost of free | Recommendation |
|---|---|---|---|
| Supabase Pro $25 | Free tier + pg_dump backups via Actions | Backup/restore ops on you; pause risk pre-launch | **Pay at go-live** (customer data) |
| Vercel Pro $20 | Cloudflare Workers (Hobby = ToS violation) | Adapter config, no previews | Either; CF if cash-tight |
| EAS $19–199 | Free tier; local builds later | None at pilot | Free until ~15 gyms |
| Resend Pro $20 | **Brevo 300/day free** | Template rework (~1 h) | Free win — adopt |
| Sentry Team $26 | Developer free + alert forwarding | 1 dashboard user | Free until revenue |
| PostHog | Free tier (1M events) | None ≤ ~120 gyms | Free |
| Stripe ~3% | E-transfer + PDF invoice | ~15 min/mo manual work | Free until ~10 gyms |
| GitHub Team $8 | GitHub Free | Nothing at 2 users | Free — drop Team |
| Apple $99/yr | — none — | — | Must pay |
| Google Play $25 | Sideload APK | Bad member UX | Pay once |
| Domain $12/yr | Platform subdomain | Credibility + email auth | Keep paying |

**All-free configuration:** ~$10/mo effective (Apple + domain amortized) — vs $55/mo in DEPLOY.md, vs $94/mo originally budgeted.
**Recommended configuration:** all-free + Supabase Pro = **~$35/mo** at go-live. The $25 buys the one thing a free stack cannot self-provide safely: professionally managed backups of the first customer's member database.

---

## Sources

- [Supabase pricing](https://supabase.com/pricing) · [UI Bakery Supabase pricing breakdown](https://uibakery.io/blog/supabase-pricing) · [Free-tier pause behavior](https://shadhujan.medium.com/how-to-keep-supabase-free-tier-projects-active-d60fd4a17263)
- [Vercel fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines) · [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Expo plans & billing](https://docs.expo.dev/billing/plans/)
- [Brevo transactional email comparison](https://www.brevo.com/blog/best-transactional-email-services/) · [Mailtrap service comparison](https://mailtrap.io/blog/transactional-email-services/) · [SES alternatives / free-tier caveat](https://www.buildmvpfast.com/alternatives/amazon-ses)
