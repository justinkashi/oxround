# OxRound — Business-Plan-Driven Stack Review

> Written 2026-07-02. Method: extract hard constraints from the business plan (Investor Brief, BUDGET.md, ROADMAP.md), verify each stack layer against the July-2026 state of the market, revise where the evidence demands it.
> Verdict summary: **the stack survives the business plan — with 6 revisions.** No layer replacement is justified.

---

## Part 1 — What the business plan demands of the stack

| # | Business plan fact | Source | Stack requirement it creates |
|---|---|---|---|
| R1 | 1 technical founder builds everything; "key-person dependency is the risk that kills the product" | Investor Brief §6, MAINTENANCE.md | Boring, popular, documented tech. Any contractor must be productive in days. No exotic platforms. Minimize service count. |
| R2 | Lean Founder Build ($50–100k) is the realistic funding scenario; contractor fallback budget is only ~$5–10k | Investor Brief §5 | Managed services only. Infra must run <$100/mo at pilot with zero ops headcount. |
| R3 | Milestones: MVP at G1 → 3 paying gyms in 6 mo → 10 in 12 mo | Investor Brief §6 | Optimize for the 1–10 gym range. Nothing bought for 250-gym scale. But multi-tenant from day one (re-architecture mid-growth would consume the entire runway). |
| R4 | ~94% gross margin at scale is the pitch | BUDGET.md §4 | Infra cost per gym must stay single-digit dollars. Fixed-cost services (Vercel, Supabase base) preferred over per-seat/per-request pricing. |
| R5 | Beachhead is Quebec; Law 25 fully in force, penalties up to CA$25M or 4% of turnover | Investor Brief §3, MAINTENANCE.md | Every transfer of personal data outside Quebec needs a privacy impact assessment concluding "essentially equivalent" protection. Canadian data residency materially reduces this burden. |
| R6 | Member demographic: WhatsApp/cash/e-transfer users, 30s–50s; app adoption is the hardest deployment problem; booking gating + push notifications are the adoption levers | ONBOARDING.md, critique | Push notifications must be reliable and store distribution must exist. Auth must be low-friction (OTP, not magic link). |
| R7 | Revenue depends on the CRM being sellable at $99–199/mo vs Mindbody; differentiation = boxing-specific UX + affordability, not feature breadth | Investor Brief §3–4 | Development velocity is the competitive weapon. Stack choices that cost founder-hours (self-hosting, custom auth, multi-repo overhead) directly reduce the win probability. |
| R8 | "Payments visibility" sold to investors; manual tracking Phase 1, Stripe Connect Phase 3 | Investor Brief §2, D-16 | Schema must support payment history now; PCI never touches our stack (Stripe-hosted). |

---

## Part 2 — Layer-by-layer verdicts

### 2.1 Backend platform: Supabase — **KEEP, move region to Canada (REVISION 1)**

- The July-2026 consensus for solo/duo founders remains that Supabase is the most complete all-in-one (Postgres + auth + realtime + storage + functions) with low lock-in ([MakerKit](https://makerkit.dev/blog/tutorials/best-database-software-startups), [Encore](https://encore.dev/articles/supabase-alternatives)). Satisfies R1, R2, R7.
- Alternatives rejected:
  - **Convex** — reactive TypeScript backend, strong for realtime, but no SQL/RLS, harder to hand to a contractor, higher lock-in ([Bytebase comparison](https://www.bytebase.com/blog/convex-vs-supabase/)). Fails R1.
  - **Neon** — database only; we'd re-add auth, storage, realtime, functions as separate services. Fails R1/R2 (service sprawl).
  - **Self-hosted anything** — BUDGET.md §7 already concluded not before $50k MRR. Confirmed.
- **REVISION 1: deploy to `ca-central-1` (Canada Central), not US-East.** Supabase now lists Canada Central as a selectable region ([Supabase regions doc](https://supabase.com/docs/guides/platform/regions)). ARCHITECTURE.md §15 chose US-East "for Quebec proximity" — ca-central-1 (Montreal) is closer AND keeps member PII in Canada, which materially reduces the Law 25 transfer-assessment burden (R5). Caveat that stays true regardless: Supabase is a US company, so a transfer impact assessment + DPA is still required under Law 25 — residency helps, it does not exempt ([Upper Harbour Law 25 guide](https://www.upperharbour.ca/resources/law-25-saas-compliance), [Pilotcore on Canadian residency](https://pilotcore.io/blog/canadian-data-residency-and-the-public-cloud)).
- RLS multi-tenancy pattern confirmed as the production-standard approach; two operational notes from production users: index every column referenced in RLS policies, and test policies from the client SDK because the SQL editor bypasses RLS ([MakerKit RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)). Our migration 0001 already indexes `gym_id` columns.

### 2.2 CRM web framework: Next.js — **KEEP, target v16 not v14 (REVISION 2)**

- As of mid-2026: App Router is stable and recommended for new SaaS; Pages Router is in maintenance mode ([Next.js 16 release](https://nextjs.org/blog/next-16), [App Router vs Pages Router for SaaS 2026](https://www.buildmvpfast.com/blog/nextjs-app-router-vs-pages-router-saas-2026)).
- Counter-evidence noted: RSC deserialization had four rounds of security patches across late 2025–early 2026 ([same source](https://www.buildmvpfast.com/blog/nextjs-app-router-vs-pages-router-saas-2026)). Mitigation is operational, not architectural: Renovate auto-patching (already in MAINTENANCE.md) — not a reason to switch frameworks.
- **REVISION 2: upgrade the scaffold from Next 14 → 16 before the pilot.** ARCHITECTURE.md specified 14 (written when 14 was current); starting a 2026 product two majors behind means paying the `params`-as-Promise and caching-default migrations later under customer pressure ([v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)). Doing it now costs hours; doing it at 10 gyms costs a release cycle.

### 2.3 Member app: Expo/React Native — **KEEP; PWA rejected; two implementation revisions**

- PWA was the cheapest alternative and would kill R6: on iOS, web push works only after the user manually installs via Safari → Share → Add to Home Screen — no store distribution, no install prompt ([MagicBell iOS PWA limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [MobiLoud](https://www.mobiloud.com/blog/progressive-web-apps-ios)). For a demographic that already resists installing apps, a hidden Safari flow is a non-starter, and booking gating (the #1 adoption lever) depends on reliable push.
- **REVISION 3: build with Expo development builds, not Expo Go** — Expo's official recommendation for production apps since SDK 54; current SDK is 55 ([Expo docs](https://expo.dev/), [Expo camera guide 2026](https://reactnativerelay.com/article/react-native-camera-image-picker-barcode-scanner-expo-guide)).
- **REVISION 4 (confirms critique): QR scanning via `expo-camera` only** — `expo-barcode-scanner` is deprecated; already reflected in apps/mobile/README.
- EAS pricing verified current: Free 1,000 MAU / Starter $19 (3,000 MAU) / Production $199 (50,000 MAU), now with usage-based bandwidth overages ($0.10/GiB beyond 100 GiB, 40 MiB included per extra MAU) ([Expo plans](https://docs.expo.dev/billing/plans/), [Stallion pricing analysis](https://stalliontech.io/expo-eas-update-pricing)). BUDGET.md tiers remain valid; add the bandwidth line item at Tier 3+.

### 2.4 Hosting, email, monitoring, analytics, billing — **KEEP with two cost-discipline revisions**

| Layer | Verdict | Note |
|---|---|---|
| Vercel Pro $20 | Keep | Fixed cost through 250 gyms (R4). |
| Resend | Keep | **REVISION 5:** email-backed announcements blow the free tier's 100/day cap at one gym (critique of BUDGET: one 80-member blast ≈ the cap). Announcements are push-first, email opt-in only; budget Resend Pro ($20) from Phase 2, not at 50 gyms. |
| Sentry | Keep | **REVISION 6 (R2):** start on free Developer tier (1 user) with alert forwarding to the second founder; Team $26 only after first paying gym. Saves $78–156 during pilot — trivial in absolute terms but the Lean Founder scenario prices founder discipline, and BUDGET.md itself flags this. |
| PostHog | Keep, defer instrumenting to Phase 2 | Free tier covers ~120 gyms at realistic event volumes (critique corrected BUDGET's 4x overestimate). |
| Stripe | Keep for OxRound-billing of gyms | Settle in CAD (avoids conversion on every invoice — critique note). Member payments stay out of scope until Phase 3 Stripe Connect; margin model (D-16) must be resolved before any Connect work. |
| pnpm workspaces, no Turborepo | Keep | Already implemented; matches R1/R7. |

### 2.5 What the business plan says we must NOT add (anti-stack)

No Kubernetes/AWS-direct, no microservices, no separate API server (PostgREST + Edge Functions suffice at 10-gym scale), no custom auth, no self-hosted analytics, no LLM features in the paid product before Phase 3 (R3: nothing ships before revenue that doesn't move the 10-gym target).

---

## Part 3 — Revised stack (single source of truth)

| Layer | Choice (revised) | Changed? |
|---|---|---|
| Backend | Supabase Pro, **`ca-central-1` (Montreal)** | ✅ region |
| CRM web | **Next.js 16** (App Router) + TS + Tailwind + shadcn/ui | ✅ version |
| Member app | Expo (SDK 55+), **development builds**, NativeWind, Expo Router | ✅ build method |
| QR scan | **`expo-camera` only** | ✅ (deprecated pkg removed) |
| Auth | Supabase Auth — magic link (CRM web), **email OTP (mobile)** | ✅ per D-08 |
| DB | Postgres 15 + RLS, `gym_id` tenancy, soft-delete pattern | — |
| Monorepo | pnpm workspaces (no Turborepo) | — (already revised) |
| Hosting | Vercel Pro | — |
| Mobile CI/CD | EAS Free → Starter $19 at ~1.4K app users | — (pricing re-verified) |
| Email | Resend; **Pro from Phase 2** (announcement blasts) | ✅ timing |
| Push | Expo Notifications → APNs/FCM | — |
| Errors | Sentry **Developer (free) during pilot** → Team | ✅ timing |
| Analytics | PostHog, instrument in Phase 2 | — |
| Billing | Stripe, **CAD settlement** | ✅ currency |

Pilot infra cost after revisions: ~$55–63/mo (drops Sentry $26 and GitHub Team optional) vs $94 modeled — margin at 1 gym improves from ~35% to ~55%.

---

## Part 4 — Actions taken / to take

1. ✅ ARCHITECTURE.md updated: region, Next.js version, expo-camera, Stripe fee + EAS price corrections (they contradicted BUDGET.md).
2. ✅ `apps/web` upgraded to Next 16.2 + React 19.2 — typecheck + prod build verified clean, no code changes required.
3. ⬜ When creating the Supabase project: pick `ca-central-1`, sign the DPA, record the transfer impact assessment note for Law 25 (member PII enumerated in MAINTENANCE.md).
4. ⬜ BUDGET.md: add EAS bandwidth-overage line at Tier 3+; re-cost Tier 0 with Sentry free.
5. ⬜ D-16 (Connect margin model) remains the only stack-adjacent business decision that blocks Phase 3 revenue claims.

---

## Sources

- [Supabase — Available regions](https://supabase.com/docs/guides/platform/regions)
- [Upper Harbour — Law 25 and your SaaS stack](https://www.upperharbour.ca/resources/law-25-saas-compliance)
- [Pilotcore — Canadian data residency & public cloud](https://pilotcore.io/blog/canadian-data-residency-and-the-public-cloud)
- [MakerKit — Supabase RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [MakerKit — Best database software for startups](https://makerkit.dev/blog/tutorials/best-database-software-startups)
- [Encore — Supabase alternatives 2026](https://encore.dev/articles/supabase-alternatives)
- [Bytebase — Convex vs Supabase](https://www.bytebase.com/blog/convex-vs-supabase/)
- [Next.js 16 release](https://nextjs.org/blog/next-16) · [v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [BuildMVPFast — App Router vs Pages Router for SaaS 2026](https://www.buildmvpfast.com/blog/nextjs-app-router-vs-pages-router-saas-2026)
- [MagicBell — PWA iOS limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [MobiLoud — PWAs on iOS](https://www.mobiloud.com/blog/progressive-web-apps-ios)
- [Expo — Plans & billing](https://docs.expo.dev/billing/plans/) · [Stallion — EAS Update pricing 2026](https://stalliontech.io/expo-eas-update-pricing)
- [React Native Relay — Expo camera guide 2026](https://reactnativerelay.com/article/react-native-camera-image-picker-barcode-scanner-expo-guide)
