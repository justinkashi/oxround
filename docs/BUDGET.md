# OxRound — Infrastructure Cost Model

> All prices in USD. Sourced directly from vendor pricing pages on 2026-06-30.
> Exchange rate note: CAD prices = USD × ~1.36. OxRound revenue likely priced in CAD, so factor this when reading margins.

---

## 1. Assumptions & Usage Model

The cost model is driven by these usage variables, which scale with number of gyms:

| Variable | Per Gym / Month | Notes |
|---|---|---|
| Average members per gym | 100 | Typical boxing gym: 50–300 |
| Member app users (80% adoption) | 80 | Members who install the app |
| OTA update MAU (70% of app users) | 56 | Users who receive at least 1 OTA update/mo |
| Check-ins (3×/week × 100 members) | 1,300 | Main Edge Function traffic |
| Emails sent | 60 | Welcome, reminders, alerts, announcements |
| Announcement push notifications | 8 | Realtime broadcast events |
| DB data per gym per year | ~10 MB | Transactional data only |
| Media storage per gym per year | ~15 MB | Profile photos + announcement images |
| Analytics events (CRM + app) | ~36,000 | PostHog events |
| Edge Function calls | ~1,500 | check-in + auth hooks + push |
| Realtime concurrent connections | 1–2 | Live check-in dashboard feed |

---

## 2. Service-by-Service Pricing (Current Rates)

### Supabase
Plan: **Pro — $25/mo**
Includes 1 project + $10 compute credit (covers 1 Micro instance).

| Resource | Included | Overage |
|---|---|---|
| Auth MAU | 100,000 | $0.00325/MAU |
| DB disk | 8 GB | $0.125/GB |
| File storage | 100 GB | $0.0213/GB |
| Egress (DB) | 250 GB | $0.09/GB |
| Realtime connections | 500 concurrent | $10/1,000 |
| Realtime messages | 5M/mo | $2.50/M |
| Edge Functions | 2M invocations | $2/1M |
| Compute — Micro (included) | 1 GB RAM, 2-core | $10/mo |
| Compute — Small | 2 GB RAM, 2-core | $15/mo extra |
| Compute — Medium | 4 GB RAM, 2-core | $60/mo extra |

**Compute upgrade triggers:** Move from Micro → Small when concurrent DB connections regularly exceed 40 (around 30–50 active gyms). Move Small → Medium around 100+ gyms with real-time concurrent check-ins.

---

### Vercel
Plan: **Pro — $20/mo** (includes $20 usage credit)

| Resource | Included | Overage |
|---|---|---|
| Edge requests | 10M/mo | $2/1M |
| Fast data transfer | 1 TB/mo | $0.15/GB |
| Functions active CPU | 4 hrs/mo | $0.128/hr |
| Function invocations | 1M/mo | $0.60/1M |
| ISR reads | 1M/mo | $0.40/1M |
| Build minutes | Pay-as-you-go | ~$0.014/min |

**Reality check:** A Next.js CRM with 200 concurrent users at 100-gym scale uses ~50–100 GB data transfer and ~2M edge requests/mo. Stays within Pro tier indefinitely.

---

### Expo EAS (Mobile CI/CD + OTA Updates)

| Plan | Monthly | Build Credit | OTA Update MAU | Notes |
|---|---|---|---|---|
| **Free** | $0 | 15 iOS + 15 Android builds | 1,000 | Low-priority queue, 45-min timeout |
| **Starter** | $19 | $45 credit | 3,000 | High-priority, 2-hr timeout |
| **Production** | $199 | $225 credit | 50,000 | 2 concurrencies, SSO, priority support |
| Enterprise | Custom | $1,000 credit | 1M+ | — |

**Build cost (when over included credit):**
- Android build: ~$0.06–$0.20/min of build time. A typical Expo build = 10–20 min → ~$1–4/build.
- iOS build: similar.
- Starter's $45 credit ≈ ~10–15 extra builds beyond the plan's included count. Sufficient for monthly release cadence.

**OTA Update MAU thresholds for OxRound:**
- < ~1,400 active app users: Free plan (1,000 OTA MAU × ~70%)
- 1,400–4,300 active app users: Starter $19 (3,000 OTA MAU)
- 4,300–71,000 active app users: Production $199 (50,000 OTA MAU)

---

### Resend (Transactional Email)

| Plan | Monthly | Emails Included | Overage |
|---|---|---|---|
| **Free** | $0 | 3,000/mo (100/day cap) | N/A |
| **Pro** | $20 | 50,000/mo | $0.90/1,000 |
| Scale | $90 | 100,000/mo | $0.90/1,000 |

**OxRound email volume:** ~60 emails/gym/mo. Pro plan handles up to ~830 gyms before overage.

---

### Sentry (Error Monitoring)

| Plan | Monthly (annual) | Users | Errors/mo |
|---|---|---|---|
| **Developer** | $0 | 1 | 5,000 |
| **Team** | $26 | Unlimited | 50,000 |
| Business | $80 | Unlimited | 50,000 |

**Note:** Developer plan is limited to 1 user — unusable for a 2-person team. Team plan ($26) covers both founders and is sufficient through 100+ gyms.

---

### PostHog (Product Analytics)

| Tier | Cost | Events/mo |
|---|---|---|
| Free | $0 | 1,000,000 |
| Pay-as-you-go | $0 base | 1M+ at $0.00005/event (volume discounts apply) |

**Volume pricing after 1M events:**
- 1M–2M: $0.00005/event → $50/M
- 2M–15M: $0.0000343/event → $34.3/M
- 15M–50M: $0.0000295/event
- 50M+: $0.0000218/event

**OxRound event volume:** ~36,000 events/gym/mo.
- Free tier covers up to ~27 gyms.
- 50 gyms → 1.8M events → ~$40/mo overage.
- 100 gyms → 3.6M events → ~$90/mo.
- 250 gyms → 9M events → ~$240/mo.

---

### Stripe (OxRound Billing of Gym Owners)

Standard rate: **2.9% + $0.30 per transaction.**

| OxRound Plan | Gross Revenue | Stripe Fee | Net Revenue |
|---|---|---|---|
| Starter ($99/gym) | $99 | $3.17 (3.2%) | $95.83 |
| Pro ($149/gym) | $149 | $4.62 (3.1%) | $144.38 |
| Growth ($199/gym) | $199 | $6.07 (3.0%) | $192.93 |
| Scale ($299/gym) | $299 | $8.97 (3.0%) | $290.03 |

Stripe fees are a revenue cost, not an infrastructure cost, but included here for complete unit economics.

---

### Other Services

| Service | Plan | Cost/mo | Notes |
|---|---|---|---|
| Apple Developer Program | Annual | $8.25 | $99/yr — required for iOS App Store |
| Google Play Developer | One-time | ~$0 | $25 one-time fee, amortized to $0 |
| GitHub | Free or Team | $0–$16 | Free for public; Team for private ($4/user/mo) |
| Domain (oxround.com) | Annual | ~$1 | ~$12/yr |
| Cloudflare | Free | $0 | DDoS, DNS, caching layer on top of Vercel |

---

## 3. Cost by Scale Tier

### Tier 0 — MVP / Pilot (1 gym, ~100 members, ~80 app users)
*G1 Boxing is the customer. Revenue: $99–$199/mo.*

| Service | Plan | Cost |
|---|---|---|
| Supabase | Pro (Micro compute) | $25.00 |
| Vercel | Pro | $20.00 |
| Expo EAS | Free (56 OTA MAU) | $0.00 |
| Resend | Free (~60 emails) | $0.00 |
| Sentry | Team | $26.00 |
| PostHog | Free (~36K events) | $0.00 |
| GitHub | Team (2 users) | $8.00 |
| Apple Dev | Annual / 12 | $8.25 |
| Domain + misc | — | $2.00 |
| **Subtotal (infra)** | | **$89.25** |
| Stripe fee (1 gym @ $149) | 2.9% + $0.30 | $4.62 |
| **Total monthly cost** | | **~$94/mo** |

**Revenue at $149/gym:** $149
**Net after Stripe:** $144.38
**Gross profit after all costs:** $50 (~35%)

*Note: Sentry Team is optional at this stage; could use Sentry Developer (free) for first few months.*

---

### Tier 1 — Early Traction (5 gyms, ~500 members, ~400 app users)
*Approaching product-market fit. Revenue: $495–$995/mo.*

| Service | Plan | Cost |
|---|---|---|
| Supabase | Pro (Micro compute) | $25.00 |
| Vercel | Pro | $20.00 |
| Expo EAS | Free (~280 OTA MAU) | $0.00 |
| Resend | Free (~300 emails) | $0.00 |
| Sentry | Team | $26.00 |
| PostHog | Free (~180K events) | $0.00 |
| GitHub | Team (2 users) | $8.00 |
| Apple Dev | Annual / 12 | $8.25 |
| Domain + misc | — | $2.00 |
| **Subtotal (infra)** | | **$89.25** |
| Stripe fee (5 gyms avg $149) | ~3.1% | $23.10 |
| **Total monthly cost** | | **~$112/mo** |

**Revenue (5 × $149):** $745
**Net after Stripe:** $721.90
**Gross profit after all costs:** $610 (~82%)

---

### Tier 2 — Growth (20 gyms, ~2,000 members, ~1,600 app users)
*Quebec-region rollout. Revenue: ~$3,000/mo.*

| Service | Plan | Cost |
|---|---|---|
| Supabase | Pro (Micro compute) | $25.00 |
| Vercel | Pro | $20.00 |
| Expo EAS | Starter ($19, 1,120 OTA MAU) | $19.00 |
| Resend | Free (~1,200 emails) | $0.00 |
| Sentry | Team | $26.00 |
| PostHog | Free (~720K events) | $0.00 |
| GitHub | Team (2 users) | $8.00 |
| Apple Dev | Annual / 12 | $8.25 |
| Domain + misc | — | $5.00 |
| **Subtotal (infra)** | | **$111.25** |
| Stripe fee (20 gyms avg $149) | ~3.1% | $92.20 |
| **Total monthly cost** | | **~$204/mo** |

**Revenue (20 × $149):** $2,980
**Net after Stripe:** $2,887.80
**Gross profit after all costs:** $2,684 (~90%)

---

### Tier 3 — Regional Scale (50 gyms, ~5,000 members, ~4,000 app users)
*Multi-province expansion. Revenue: ~$7,500/mo.*

| Service | Plan | Cost |
|---|---|---|
| Supabase | Pro + Small compute (+$15) | $40.00 |
| Vercel | Pro | $20.00 |
| Expo EAS | Starter ($19, 2,800 OTA MAU — at limit) | $19.00 |
| Resend | Pro ($20, ~3,000 emails) | $20.00 |
| Sentry | Team | $26.00 |
| PostHog | Free tier + overage (~1.8M events → ~$40) | $40.00 |
| GitHub | Team | $8.00 |
| Apple Dev | Annual / 12 | $8.25 |
| Domain + misc | — | $10.00 |
| **Subtotal (infra)** | | **$191.25** |
| Stripe fee (50 gyms avg $149) | ~3.1% | $230.35 |
| **Total monthly cost** | | **~$422/mo** |

**Revenue (50 × $149):** $7,450
**Net after Stripe:** $7,219.65
**Gross profit after all costs:** $7,028 (~94.5%)

*⚠️ Expo EAS Starter is at its 3K OTA MAU ceiling here. If release cadence is >1/month, upgrade to Production ($199) and infra rises to ~$371.25.*

---

### Tier 4 — National (100 gyms, ~10,000 members, ~8,000 app users)
*English Canada expansion. Revenue: ~$15,000/mo.*

| Service | Plan | Cost |
|---|---|---|
| Supabase | Pro + Small compute | $40.00 |
| Vercel | Pro | $20.00 |
| Expo EAS | **Production** ($199, 5,600 OTA MAU → 50K incl.) | $199.00 |
| Resend | Pro (~6,000 emails) | $20.00 |
| Sentry | Team | $26.00 |
| PostHog | ~3.6M events → ~$90/mo | $90.00 |
| GitHub | Team (3 devs) | $12.00 |
| Apple Dev | Annual / 12 | $8.25 |
| Domain + misc | — | $15.00 |
| **Subtotal (infra)** | | **$430.25** |
| Stripe fee (100 gyms avg $149) | ~3.1% | $460.70 |
| **Total monthly cost** | | **~$891/mo** |

**Revenue (100 × $149):** $14,900
**Net after Stripe:** $14,439.30
**Gross profit after all costs:** $14,009 (~94.1%)

---

### Tier 5 — Series A Ready (250 gyms, ~25,000 members, ~20,000 app users)
*National + US pilot. Revenue: ~$40,000/mo.*

| Service | Plan | Cost |
|---|---|---|
| Supabase | Pro + Medium compute (+$60) | $85.00 |
| Vercel | Pro (may need minor overage ~$10) | $30.00 |
| Expo EAS | Production (14,000 OTA MAU, well within 50K) | $199.00 |
| Resend | Pro (~15,000 emails, within 50K) | $20.00 |
| Sentry | Team | $26.00 |
| PostHog | ~9M events → ~$240/mo | $240.00 |
| GitHub | Team (4 devs) | $16.00 |
| Apple Dev | Annual / 12 | $8.25 |
| Domain + misc | — | $20.00 |
| **Subtotal (infra)** | | **$644.25** |
| Stripe fee (250 gyms avg $169) | ~3.1% | $1,308.63 |
| **Total monthly cost** | | **~$1,953/mo** |

**Revenue (250 × $169 avg):** $42,250
**Net after Stripe:** $40,941.38
**Gross profit after all costs:** $40,297 (~95.4%)

---

## 4. Cost Summary Table

| Tier | Gyms | Members | Infra Cost/mo | Stripe Fee/mo | Total Cost/mo | Revenue/mo | Gross Margin |
|---|---|---|---|---|---|---|---|
| 0 — MVP | 1 | 100 | $89 | $5 | $94 | $149 | ~37% |
| 1 — Early | 5 | 500 | $89 | $23 | $112 | $745 | ~85% |
| 2 — Growth | 20 | 2,000 | $111 | $92 | $204 | $2,980 | ~93% |
| 3 — Regional | 50 | 5,000 | $191 | $230 | $422 | $7,450 | ~94% |
| 4 — National | 100 | 10,000 | $430 | $461 | $891 | $14,900 | ~94% |
| 5 — Series A | 250 | 25,000 | $644 | $1,309 | $1,953 | $42,250 | ~95% |

*Revenue assumes $149/gym avg across tiers. Actual will vary by plan mix.*

---

## 5. Key Cost Drivers & Upgrade Triggers

### What scales linearly with gyms
- **Stripe fees** (3.1% of revenue) — unavoidable, baked into pricing.
- **PostHog** (past 27 gyms) — $4–5/gym/month at scale. Well worth it for retention insights.

### What scales in steps (plan upgrades)
- **Supabase compute** — Micro → Small at ~30–50 gyms, Small → Medium at ~150+ gyms. Total jump: +$15 then +$45.
- **Expo EAS** — Free → Starter at ~2K app users, Starter → Production at ~5–8K app users. Big jump: +$180/mo.
- **Resend** — Free → Pro at ~50 gyms (+$20/mo). Very small.

### What is essentially fixed
- **Vercel** — Pro plan handles 250+ gyms without overage. Fixed at $20.
- **Sentry** — Team plan is sufficient through all tiers. Fixed at $26.
- **Supabase base** — $25/mo covers DB, auth, storage, edge functions, realtime through all tiers.

---

## 6. Cost Per Gym (Unit Economics)

| Tier | Gyms | Total Infra/mo | Cost/Gym/mo | Revenue/Gym/mo | Infra Margin |
|---|---|---|---|---|---|
| 0 — MVP | 1 | $89 | $89.00 | $149 | 40% |
| 1 — Early | 5 | $89 | $17.80 | $149 | 88% |
| 2 — Growth | 20 | $111 | $5.55 | $149 | 96% |
| 3 — Regional | 50 | $191 | $3.82 | $149 | 97% |
| 4 — National | 100 | $430 | $4.30 | $149 | 97% |
| 5 — Series A | 250 | $644 | $2.58 | $169 | 98% |

Infrastructure cost per gym drops to **$2.58/gym** at 250-gym scale. The business is extremely scalable — infra is not the cost bottleneck at any stage. Headcount will dominate long before infra does.

---

## 7. Cheaper Alternatives (If Cost Reduction Is Ever Needed)

These alternatives trade developer experience or reliability for lower cost. Not recommended until $50K+ MRR.

| Service | Current | Alternative | Savings | Trade-offs |
|---|---|---|---|---|
| Expo EAS Production | $199/mo | GitHub Actions + Fastlane (self-managed CI) | $199/mo | ~2 weeks setup time, fragile, no OTA |
| Vercel Pro | $20/mo | Railway ($5/mo) or Fly.io | $15/mo | No preview deploys, manual config, slower DX |
| Sentry Team | $26/mo | GlitchTip (self-hosted) | $26/mo | Self-managed, no mobile SDK |
| PostHog PAYG | $40–240/mo | Self-hosted PostHog (ClickHouse) | $30–200/mo | Requires infra management, backups |
| Supabase Pro | $25/mo | Self-hosted Postgres on Railway ($5/mo) | $20/mo | No built-in auth/realtime/storage, massive dev effort |
| Resend Pro | $20/mo | AWS SES ($0.10/1K emails) | ~$19.99/mo | More setup, worse DX, no React Email integration |

**Verdict:** None of these are worth doing before $50K MRR. The combined savings at 50-gym scale is ~$260/mo against $7,450/mo revenue. The founder-hours saved by managed services vastly outweigh the costs.

---

## 8. When to Revisit Infrastructure

| Milestone | Action |
|---|---|
| 30–50 gyms | Upgrade Supabase compute from Micro → Small (+$15/mo) |
| 50 gyms | Upgrade Resend Free → Pro (+$20/mo) |
| 5,000 app users | Upgrade Expo EAS Starter → Production (+$180/mo) |
| 100 gyms | Consider Supabase Small → Medium if query latency increases (+$45/mo) |
| $100K MRR | Negotiate volume discounts with Vercel and Expo. Evaluate Stripe fees vs. alternatives (Paddle, Lemon Squeezy) |
| $500K MRR | Evaluate multi-region Supabase, dedicated Supabase project per enterprise gym, CDN for media |
| Expansion to EU gyms | Add Supabase EU project for GDPR data residency (~$25/mo more) |
| Quebec Law 25 compliance | Legal review of Supabase US-East data residency. May need EU project or Canadian data center |

---

## 9. CAD Impact Note

OxRound's pricing to Canadian gym owners will likely be in CAD. If pricing is set at CAD $149/gym:
- USD equivalent at ~1.36 exchange rate: **$110 USD/gym**
- Stripe processes in USD and converts → no direct impact on fees
- Infrastructure bills are in USD — effective CAD cost at 250 gyms: $644 × 1.36 = **CAD $876/mo**
- At CAD $149 avg: 250 gyms = **CAD $37,250/mo revenue**
- After all costs (CAD-adjusted): **CAD ~$34,000/mo gross profit (~91%)**

If pricing gyms in USD from the start (which makes cross-border expansion cleaner): no adjustment needed.

---

## 10. Total Cost of Ownership — 12-Month Projection (Optimistic Growth)

Assumes growth from 1 gym (month 1) to 50 gyms (month 12) at $149/gym avg.

| Month | Gyms | Revenue/mo | Infra Cost | Stripe Fee | Net Profit |
|---|---|---|---|---|---|
| 1 | 1 | $149 | $89 | $5 | $55 |
| 2 | 2 | $298 | $89 | $9 | $200 |
| 3 | 4 | $596 | $89 | $18 | $489 |
| 4 | 6 | $894 | $89 | $28 | $777 |
| 5 | 8 | $1,192 | $89 | $37 | $1,066 |
| 6 | 12 | $1,788 | $111 | $55 | $1,622 |
| 7 | 16 | $2,384 | $111 | $74 | $2,199 |
| 8 | 22 | $3,278 | $111 | $102 | $3,065 |
| 9 | 28 | $4,172 | $111 | $129 | $3,932 |
| 10 | 36 | $5,364 | $191 | $166 | $5,007 |
| 11 | 44 | $6,556 | $191 | $203 | $6,162 |
| 12 | 50 | $7,450 | $191 | $231 | $7,028 |
| **Year 1 Total** | | **~$33,921** | **~$1,462** | **~$1,057** | **~$31,402** |

Infrastructure over 12 months: ~**$1,462 total**. Revenue: ~**$33,921**. Infrastructure as % of revenue: **4.3%**.

---

*Prices verified from vendor pricing pages on 2026-06-30. All costs subject to change; set calendar reminders to re-verify at each scale milestone.*
