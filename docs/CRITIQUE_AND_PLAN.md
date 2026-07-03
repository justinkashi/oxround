# OxRound — Comprehensive Critique, Deployment Plan & Maintenance Plan

> This document reviews every statement across amir_texts_june.md, ARCHITECTURE.md, BUDGET.md, and the Investor Brief, then plans gym deployment/migration and product maintenance. No statement is exempted from scrutiny.

---

## PART 1: COMPREHENSIVE CRITIQUE

---

### 1.1 amir_texts_june.md — Line by Line

**"scan to enter (every member has their own unique QR code)"**
Solid. This is the right starting point and the one feature gym owners immediately understand. The problem is the UX around it. "Scan to enter" implies the QR is scanned at the door — but by what, and by whom? The architecture proposes a kiosk iPad. That means you need to sell or provision a tablet to every gym. G1 Boxing may not have a spare iPad. Who pays for the hardware? Who mounts it? What happens when it falls off the wall? This deployment cost is completely unmodeled. If the kiosk isn't provided, check-in becomes "member shows phone to coach," which works but requires coach presence at the door at all times — not realistic for large classes.

**"Logs (scanned at 3pm wednesdays so records activity)"**
This phrasing reveals the real use case: not just check-in security but attendance visibility. The owner wants to know who came, when, and how often — for retention purposes. The architecture captures this in `check_ins` but does not define what the attendance dashboard actually shows. "Logs" should produce: member-level attendance history (last 30 days, streak, total visits), class-level attendance (who came to each session), and gym-level overview (busiest days/times, attendance trend). None of this is scoped in the MVP feature list — only the data table is designed.

**"Interconnected (owner must be able to deactivate membership if not paid)"**
This is the most operationally critical feature for gym owners. They currently call/text members who haven't paid. The system needs to close the loop: when the owner marks a membership as overdue or deactivates it, the member's QR stop working. This is specified in the architecture (Edge Function checks `gym_members.status`), which is correct. What is NOT modeled: the notification flow. When a membership is deactivated, does the member get an email? Do they see it in the app? The current architecture has a notification table but no explicit deactivation-triggered notification. Without this, the member shows up, their QR doesn't work, they're confused and embarrassed at the door — terrible UX.

**"community (somewhere the owner can post notes and pictures about holidays, when the gym is closed, fight announcements, event/run announcements, etc.)"**
Amir's description is explicitly one-directional: owner posts, members read. The architecture implements this correctly via the `announcements` table. The issue is that boxing gym culture is intensely communal — members celebrate each other's fights, comment on results, react to gym news. The current implementation gives members zero way to interact with posts. Even just a like/reaction (no comment threading needed in MVP) would dramatically increase member app engagement and stickiness. Without it, members will still default to the WhatsApp group for community — meaning the app doesn't actually replace the behavior that owns their attention.

**"We want to be (1) specific to boxing for now"**
This is the correct instinct and is repeated in the investor brief. But neither the architecture nor the schema actually does anything boxing-specific yet. Every feature listed — QR check-in, attendance, membership management, announcements — is generic to any fitness gym. The boxing specificity is entirely deferred to "Future Training Modules" at 24+ months. This means the MVP competes on the same terms as Mindbody Lite, Glofox, PushPress, etc., without the years of polish. The boxing-specific differentiation needs to move forward: member skill level, weight class, fight record, sparring log, fight camp mode. Even just the vocabulary — calling a session a "camp" not a "class," calling attendance a "log" not a "booking," using boxing terminology in the UI — creates differentiation that doesn't require months of engineering.

**"(2) as strong as them but affordable"**
This is where the strategy gets risky. "As strong as them" (Mindbody, Glofox) is an enormous claim. These platforms have 10-15 years of development and teams of 50-200 engineers. Trying to match their feature breadth in 2 years with a 2-person team is the fastest path to building a mediocre version of everything and an excellent version of nothing. The smarter framing: "deeper on what matters for boxing, leaner everywhere else." Affordable is real and important — $99-$199/month vs. Mindbody's $139-$349+/month is genuinely competitive on price — but affordability alone doesn't win against an established product that gym owners already know.

---

### 1.2 ARCHITECTURE.md — Section by Section

**Guiding Principle 1: "Multi-tenant from day one"**
Correct architectural decision. No critique. This is the right call.

**Guiding Principle 2: "Lean stack, fast iteration"**
The stack chosen is appropriate. The critique is on the definition of "lean." Turbo.json + pnpm workspaces + monorepo is lean at 5+ packages but adds cognitive overhead for a 2-person team at month 1. A flat structure (separate repos or simple pnpm workspaces without Turborepo) is genuinely faster to start. Turborepo becomes valuable after the monorepo has 3+ apps with shared packages actually in use. Adding it on day one is premature optimization.

**Guiding Principle 3: "Mobile-first member experience"**
Correct. But "must feel native" means the Expo/React Native choice needs to be maintained without cutting corners. Common mistake: using too many `<WebView>` components inside the native shell when feature pressure hits. Commit to React Native components throughout, or just build a PWA from the start. Half-native, half-webview is worse than either.

**Guiding Principle 5: "Build the MVP. Stub everything else."**
The problem is what's included in MVP is already very large: auth, QR check-in, attendance logs, class schedule, class booking, membership status, announcements, basic member app. That is 6-8 distinct features each with their own frontend, backend, and mobile implementation. For a 2-person team building from scratch, this is 4-6 months minimum, not 0-3. The investor brief's 90-day plan (Month 2: "Build booking, cancellation, QR check-in, attendance dashboard") is treating these as simple tasks when each one is a multi-week engineering effort.

**Section 2.1: "Next.js 14 (App Router)" for CRM**
Good choice. One nuance: the App Router has genuine learning curve complexity with Server Components, the new data fetching patterns, and the ongoing changes from Next.js 14 to 15. A 2-person team under time pressure may spend significant time debugging RSC-specific behavior. Next.js Pages Router (older API) is more battle-tested and faster to move in. App Router is the right long-term choice but worth being aware of the overhead.

**Section 2.2: "expo-camera + expo-barcode-scanner" for QR scanning**
As of 2024, `expo-barcode-scanner` was deprecated in favor of `expo-camera`'s built-in barcode scanning. Using both is redundant. Use `expo-camera` with `onBarcodeScanned` prop. Also: camera permissions on iOS and Android need to be requested and explained to the user. If a member denies camera permission (thinking the app is trying to spy on them), the QR display tab still needs to work — the scanning is only needed on the kiosk, not on the member's own phone.

**Section 2.3: "pg_cron (Supabase extension) for background jobs"**
pg_cron is available on Supabase Pro and works well. Two gaps: (1) pg_cron runs SQL, not arbitrary logic, so if a reminder email requires calling Resend's API, you need a pg_cron job that calls a Supabase Edge Function via `http_post`. This works but adds a chain of dependencies. (2) pg_cron jobs have no retry mechanism — if the job fails (e.g., Resend is down), the email is silently lost. You need a `notification_queue` table with status tracking and a retry cron job, which is more complex than presented.

**Section 3: "No cross-tenant data leakage possible even with a compromised API call"**
This statement needs softening. RLS makes cross-tenant leakage very difficult but not impossible. A bug in the auth hook (which injects `gym_id` into the JWT) could inject the wrong gym_id. A Supabase library bug could bypass RLS. The statement should be "cross-tenant leakage is enforced at the database layer and is extremely difficult to achieve even with a bug in application code" — not "impossible." Security claims should always be accurate.

**Section 4.1: `gym_members.qr_code text UNIQUE NOT NULL`**
The column is named `qr_code` but stores a token (not the QR image itself). Naming is misleading. Better: `check_in_token`. Also: the ARCHITECTURE says this is "stored hashed (bcrypt) server-side" in Section 6, but the schema just says `text`. There's a contradiction — the schema definition doesn't enforce hashing, it just stores a text value. Hashing would need to be enforced at the application layer. More critically, bcrypt is the wrong algorithm here. Bcrypt is designed to be slow, for password hashing. A random 128-bit token has enough entropy that it doesn't need slow hashing — SHA-256 or simply storing the raw token (with the token itself providing security through randomness) is appropriate. Every check-in would pay a bcrypt verification cost (~100-300ms) unnecessarily.

**Section 4.1: `gym_members.notes text` (single field)**
This is an unstructured text blob with no timestamp, no author attribution, no edit history. Any notes written in month 1 will be silently overwritten by month 6. Either: eliminate it and require all notes go through `coach_notes` (which has proper attribution and timestamps), or make it an append-only log that automatically prepends `[date] [author]:` to any new entry. A plain text field for owner notes will become a garbage dump.

**Section 4.1: `UNIQUE(gym_id, user_id)` on gym_members**
This prevents a user from having two roles at the same gym — correct. But it also means a coach cannot be a member at the same gym, which is very common. Many boxing coaches also train there. The solution: a user can have multiple gym_member records at the same gym with different roles, or add a `secondary_role` field. Current constraint breaks a real use case.

**Section 4.1: No `date_of_birth` field anywhere**
Date of birth is missing from both `profiles` and `gym_members`. It is legally required for: minor identification (parental consent, different waiver, restricted sparring), age categories in amateur boxing competition, proper identity for liability waivers, and is typically collected on every gym registration form. This is not optional data — it is baseline gym compliance data and should be in MVP.

**Section 4.2: `memberships.payment_status DEFAULT 'unknown'`**
"Unknown" as a default creates silent data rot. Every new member starts with unknown payment status, and unless the owner actively updates it, it stays unknown forever. The system then has no way to distinguish "paid but not recorded" from "genuinely hasn't paid." Better default: `pending`, with a required owner action on member creation to set it to `paid`, `cash`, `etransfer`, or `comped`. Force the decision at creation time.

**Section 4.2: `membership_plans.max_classes int — null = unlimited`**
Enforcing class caps digitally (3x/week) requires a rolling weekly window counter. This is complex to implement correctly — what's the window start day? Does a class on Sunday count toward the previous week or next? Enforcement logic is subtle and will generate support tickets. The real question is whether G1 Boxing actually enforces class caps. Most boxing gyms either sell unlimited or don't digitally enforce any cap. Cut this feature from MVP entirely. If G1 enforces it manually, track it manually.

**Section 4.3: `classes.day_of_week int[]`**
Storing `[1,3,5]` for a Monday/Wednesday/Friday class doesn't handle: gym closures on statutory holidays (Labour Day, Victoria Day, etc.), one-off session cancellations, summer schedule changes, and the mechanics of generating `class_sessions` rows from templates. Who generates the sessions? The document doesn't specify. If it's pg_cron generating sessions weekly/monthly in advance, what happens when a class is canceled after sessions are already generated? You need a cancellation mechanism on the session (already in the schema: `status = 'canceled'`), but also a notification to booked members, which is not specified.

**Section 4.3: `class_bookings.status` — missing 'attended'**
A member can be `booked` for a class and also have a `check_in` record for that session, but the booking is never reconciled. Attendance queries for "who attended class X on date Y" require joining `class_bookings` and `check_ins` on `session_id` and `gym_member_id` and reconciling discrepancies. Much cleaner: add `attended` status to bookings, and have the check-in flow update the corresponding booking status to `attended`. No-show logic: after class ends, any remaining `booked` statuses auto-set to `no_show` via pg_cron.

**Section 4.4: `check_ins.method: 'qr | manual | kiosk'`**
'qr' and 'kiosk' are redundant if the kiosk scans QR codes. Both would be QR via kiosk. Better enum: `qr_kiosk | qr_phone | manual_staff | manual_import` (the last for historical data migration). Clear and unambiguous.

**Section 4.5: `leads.source: 'walk-in | referral | instagram | website'`**
Missing: TikTok (the dominant boxing content platform for member acquisition), Facebook (common for older demographics), YouTube, fight events/tournaments, and "other" as a free-text fallback. Also missing: who captured the lead — coach or owner. If Coach A brings in a lead and Coach B does the follow-up, there's no attribution chain.

**Section 4.6: `announcements` — no reaction/read receipt**
Owners have no way to know if their announcement was seen. "Gym closed tomorrow" posted at 10pm — did members see it? A simple `announcement_reads` junction table (member_id, announcement_id, read_at) would let owners see "42 of 80 members have seen this." This is low-effort and high-value.

**Section 4.7: `coach_notes.visibility: 'coaches | owner_only'`**
Missing third option: `member_visible`. Boxing coaches regularly give technique notes they'd want the member to see in their app ("work on keeping your guard up, footwork drill video attached"). The current schema makes notes always hidden from members, which misses a key differentiation opportunity — a member-facing training log is not offered by generic gym software.

**Section 4.8: Notifications table stores `expo_push_token` per notification**
This is architecturally backwards. Push tokens live in `push_tokens` table; the notifications table should reference the recipient, not duplicate the token. The current design means if a user changes devices and their token changes, old unsent notifications in the queue still have the stale token. The send function should look up the current token from `push_tokens` at send time, not at enqueue time.

**Section 5: RLS policy `"owner manages members" FOR ALL`**
`FOR ALL` encompasses DELETE. An owner clicking the wrong button could permanently delete a member record, cascading to delete all their check_ins, memberships, bookings, and coach_notes due to `ON DELETE CASCADE`. That's a catastrophic, unrecoverable action. Members should never be hard-deleted — only soft-deleted (setting `status = 'archived'`). The DELETE operation should be blocked at the RLS layer for all roles: `FOR UPDATE` only, and the application layer presents "archive member" not "delete member."

**Section 6: "Kiosk authenticates with a service role token scoped to that gym"**
This is the most critical security flaw in the entire architecture. Supabase's service role key has **full unrestricted database access** — it bypasses all RLS policies for all gyms. If the kiosk iPad is stolen or the service role key is extracted from the app bundle, an attacker has read/write access to every gym's data in the entire platform. A service role key must never be embedded in a client device. The kiosk needs a gym-scoped JWT with minimal permissions (write to check_ins for this gym only). This requires a dedicated `kiosk` role in the auth system with its own RLS policies.

**Section 6: "Magic link is the default auth method"**
For owners and coaches logging into a web CRM: magic link is fine. For members using a mobile app: magic link is poor UX. The flow is: open app → type email → switch to email app → find magic link → click it → switch back to app. On many Android devices, this requires manually copying the link. For a member who just wants to check their class schedule before a Monday morning workout, this is a frustrating experience that will kill adoption. The member app needs: phone number + SMS OTP (most familiar to gym demographics), or Apple/Google sign-in, with email magic link as a fallback. Auth method should differ by surface.

**Section 9: "Kiosk mode — no login required on the kiosk"**
Correct on the concept but inconsistent with the service role token issue above. Also: kiosk mode needs Guided Access on iOS (device-level lock that prevents members from exiting the kiosk app and accessing the iPad's other functions). This is an iOS/Android configuration step that is completely unmentioned. If a gym mounts an iPad and doesn't enable Guided Access, any member could exit the app and access whatever is on the iPad.

**Section 10: "Stripe | 0.5% of gym billing" in the infrastructure cost table**
This is factually wrong. Stripe charges 2.9% + $0.30 per transaction — approximately 3.0-3.2% depending on plan price. The BUDGET.md correctly states 2.9% + $0.30, but the ARCHITECTURE.md states 0.5%. These two documents contradict each other. The architecture's cost estimate at the bottom of Section 10 should be struck — it belongs in BUDGET.md.

**Section 10: "EAS Production ($99/mo) or free tier"**
Expo EAS Production is $199/month, not $99/month. This is a factual error. The BUDGET.md has the correct figure. Another contradiction between documents.

**Section 11: "Supabase Pro includes basic rate limiting"**
Supabase Pro does not include configurable application-level rate limiting. It has infrastructure-level abuse protection. For the check-in Edge Function specifically, you need to implement rate limiting at the function level (e.g., max 5 check-in attempts per IP per minute) to prevent token brute-forcing. This is not handled automatically.

**Section 12: MVP timeline "0-3 months"**
The MVP scope includes: auth (magic link + custom JWT claims), member profiles, QR check-in with Edge Function, attendance log with Realtime, class schedule with session generation, class booking with capacity enforcement, membership status management, announcements with push notifications, and a full member app with 5 tabs. This is not a 3-month MVP for a 2-person team where one person is also doing sales and customer success. Realistic timeline: 4-6 months for a solid, production-worthy version of this feature set. The 3-month estimate sets a false expectation for G1 Boxing and investors.

**Section 15: "Email auth vs. phone/OTP — Email for now (free via Resend); SMS via Twilio when Quebec gyms need it"**
This decision is underdetermined. The "when Quebec gyms need it" trigger is too vague. The right question is: what percentage of G1 Boxing members currently use email reliably? For a boxing gym with members in their 30s-50s who primarily communicate via WhatsApp, the answer is probably less than 60%. SMS OTP should be evaluated as the default for members before building on top of email auth. Twilio SMS in Canada costs ~$0.0079/message — for 80 members doing 2 logins/month each, that's ~$1.26/month/gym. Negligible.

**Section 15: "Shared or per-gym Supabase project — One shared project with RLS"**
Correct decision for now. The stated trigger of "100+ gyms" for revisiting is reasonable but the actual trigger should be performance-based (query latency p99 > 200ms) rather than gym count. Gym count is a proxy but the actual constraint is DB load.

---

### 1.3 BUDGET.md — Assumption by Assumption

**"Average members per gym: 100"**
Boxing gyms are smaller than general fitness studios. Independent boxing gyms typically have 30-80 active members. G1 Boxing in Vaudreuil-Dorion (a suburb of ~40,000 people) likely has 40-80 members. 100 is optimistic as an average. Using 60-70 as a planning assumption produces more conservative and realistic unit economics. This doesn't significantly change the infra cost model but does affect the value proposition calculations (fewer members per gym = less data volume, less check-in load).

**"Member app users (80% adoption): 80 per gym"**
80% app adoption in a boxing gym population is extremely optimistic. App adoption in SMB fitness ranges from 30-60% based on industry data from similar verticals. For a first-generation app among a demographic that currently uses WhatsApp and cash, 40-50% is a realistic target at launch. The kiosk check-in (which doesn't require members to install the app) may paradoxically reduce member app adoption incentive — if your QR is just printed on a card, why download the app? Adoption needs an active incentive: class bookings, announcements, and attendance history should only be accessible in the app, not via email/WhatsApp.

**"OTA update MAU (70% of app users): 56 per gym"**
The 70% figure assumes very high app engagement. OTA MAU counts users who download at least one update per billing period. If members only open the app once a week to check the schedule and you push an update once a month, OTA MAU roughly equals active users. 70% is defensible but the downstream calculation matters less than knowing when to upgrade Expo plans — which the document does handle correctly.

**"Check-ins: 3×/week × 100 members = 1,300"**
This overstates active engagement. 3x/week is for a dedicated member. A more realistic gym distribution: 20% of members come 3+/week (dedicated), 50% come 1-2x/week (regular), 30% come less than once per week (casual/ghost members). Weighted average: ~1.6 visits/week/member. At 60 members: 576 check-ins/month. At 80 members: 768 check-ins/month. The Edge Function call volume is roughly 60% of what's modeled — no material impact on costs, but important for understanding actual product usage.

**"Emails sent: 60 per gym per month"**
Severely underestimated once the lead pipeline is active. Email breakdown at a functioning gym: welcome email for each new member (~4/month), membership expiry warnings (~8/month), overdue payment alerts (~5/month), lead follow-up emails (~6 leads × 3 emails each = 18/month), booking confirmations (~100 class bookings × opt-in confirmation = 0-100/month), announcement broadcasts to all members (~4 × 60 members = 240/month if email-based). Total: 285-385/month. Free Resend tier (3,000/month total, 100/day cap) is hit at ~15 gyms, not 50. The hard daily cap of 100 emails on the free tier means a single announcement broadcast to 100+ members per day blows the cap. Resend Pro is needed at launch if announcements are email-backed.

**"DB data: ~10MB per gym per year" and "Media storage: ~15MB per gym per year"**
The media estimate needs to be revisited. One announcement with a fight poster (JPEG, typical boxing flyer) is 1-3MB uncompressed. If the owner posts 8 announcements/month with photos, that is 8-24MB/month/gym = 96-288MB/year/gym. 100 gyms = 10-28GB/year in media alone. Supabase Storage's 100GB included covers 4-10 gym-years before overage kicks in, not the 6,667 gym-years implied by the 15MB assumption. Add a server-side image compression step (resize to max 1200px wide, compress to <500KB before storage) or use Cloudflare Images ($5/month for unlimited transformations) as a media layer. This needs to be in the architecture.

**"Sentry Developer (free) — 1 user limitation, unusable for 2-person team"**
Correct critique within the document. But the document's conclusion that Team ($26/month) is necessary from day 1 could be refined: one founder creates the Sentry account and is the single user on Developer tier. They configure Slack/email alert forwarding for the second founder. This is imperfect but saves $26/month during the first 1-3 months of pilot. Minor point but relevant for the Lean Founder Build scenario.

**"Year 1 growth: 1 gym (month 1) → 50 gyms (month 12)"**
The investor brief's own milestones say: "3 paying beta gyms within 6 months, 10 paying within 12 months." The budget's 12-month projection shows 50 gyms. This is a 5x discrepancy within OxRound's own documents. Investors who read both will notice. If the investor brief says 10 gyms at 12 months and the budget shows 50, one of them is wrong. The budget should use the investor brief's targets (10 gyms at month 12) not an independent optimistic assumption.

**"Net Profit" in the 12-month projection**
The projection shows "Net Profit" as revenue minus infra minus Stripe fees. This is gross profit on infrastructure, not net profit. Missing: any founder compensation, any contractor costs, any legal/accounting fees (10% of funds per the investor brief's use of funds allocation), any travel for gym visits, any hardware (iPad for kiosk). The "net profit" line is misleading and should be labeled "gross profit after infrastructure." True net profit at 10 gyms (realistic 12-month target) is negative unless founders take no salary.

**"No CAC modeled anywhere"**
Customer acquisition cost is real even in a founder-led sales model. Each gym acquisition involves: research + outreach (1 hour), demo prep (30 min), demo (1 hour), follow-up (30 min), onboarding (4-6 hours), first-week support (2 hours). Total: ~8-9 founder-hours per gym. At a conservative $75/hour opportunity cost: CAC ≈ $600-$675 per gym. At $149/month revenue with a ~80% 12-month retention rate, 12-month LTV ≈ $149 × 12 × 0.80 ≈ $1,432. LTV/CAC ≈ 2.1x. This is below the generally accepted 3x minimum threshold and should be modeled honestly. The CAC improves significantly if the referral loop works — each referred gym halves the CAC.

**"PostHog event volume: ~36,000/gym/month"**
This is substantially over-estimated. A more careful count: admin CRM events (2 admins × 50 events/session × 1 session/day × 22 working days) = 2,200 events. Mobile member events (50 active members × 15 events/session × 2 sessions/week × 4 weeks) = 6,000 events. Total: ~8,200/gym/month. At this rate, the free tier covers approximately 120 gyms (1M events ÷ 8,200), not 27. The budget overstates PostHog costs by roughly 4x for the first 100+ gyms.

**Exchange rate modeling**
The document notes Stripe "processes in USD and converts" — this is only true if the Stripe account's settlement currency is USD. If the Stripe account is set to CAD (which it should be for a Canadian business), Stripe collects in CAD, keeps fees in CAD, and settles in CAD. The infra bills (Supabase, Vercel, Expo) are charged in USD to a Canadian credit card, incurring 2.5% foreign transaction fee on most business cards. At $644/month infra at 250 gyms, that's ~$16/month in FX fees — minor but unmodeled.

---

### 1.4 Investor Brief — Section by Section

**Executive Summary: "live user-app prototype built around G1 Boxing"**
This is accurate but the word "production" in "the next step is a production CRM and owner dashboard" implies significant additional engineering. The prototype (the current Netlify demo) is a frontend demo, not a connected system. The gap between prototype and production is the entire backend, auth, data layer, and mobile app. This should be stated clearly: "live frontend prototype; backend and CRM MVP in development."

**Problem: "Independent gyms still run large parts of the business through WhatsApp, paper, e-transfer, spreadsheets, and disconnected tools"**
Accurate and well-framed. The critical insight here is the word "parts." Gyms don't use just one of these — they use all of them simultaneously. The owner manages member payments via e-transfer DMs, tracks attendance via paper sign-in sheets, communicates via a WhatsApp group, and stores member contacts in their phone. The value of OxRound is not replacing any one of these but eliminating the need to switch between all of them. This consolidation story is powerful and should be even more prominent.

**Solution: "payments visibility"**
The investor brief lists "payments visibility" as a core solution element. But the architecture defers all payment handling: "owners manually mark payment status" with no integration, no tracking of e-transfer confirmation, no payment history. There is a gap between what's being sold to investors and what will be built in the first 12 months. Either: (1) build a basic payment log (date, amount, method, notes) in MVP so "payments visibility" is real, or (2) remove this from the investor brief's solution description until it's actually built.

**Solution: "coach notes, and trial follow-up"**
Coach notes are Phase 2 (3-6 months) and trial follow-up (lead pipeline) is also Phase 2. Yet they appear in the executive summary as current solutions. The investor brief lists the final product vision as the immediate solution, which is misleading. Should clearly delineate what exists at launch vs. what will be built in the first 6 months.

**Beachhead: "G1 Boxing → Quebec boxing gyms → Quebec/Ontario combat sports → North America"**
This is a sound GTM sequencing. The friction point: Quebec boxing gyms are primarily French-speaking. If the product is built in English first (likely for development speed), you will hit a language barrier at step 2 ("Quebec boxing gyms"). G1 Boxing's owner and coaches may be bilingual, but the member app that goes to 80 Quebec members in Vaudreuil-Dorion needs French language support. Internationalization (i18n) is not mentioned anywhere in the architecture. Adding it retroactively is painful — add i18n scaffolding (react-i18next for web, i18n-js for RN) from day 1 even if only English is initially populated.

**Business Model: "$99/$199/$299+/location"**
These prices are in USD per the investor brief. For a Quebec market where the functional equivalent in Mindbody is USD $139-349/month, OxRound's entry point at USD $99 is well-positioned on price. However, Mindbody USD pricing effectively means CAD $190-475/month. OxRound at USD $99 = CAD ~$135 is compelling. If OxRound prices in CAD instead (CAD $129/$199/$299), the USD equivalent drops to ~$95/$146/$220 — making the economics tighter. The pricing currency decision needs to be made before the first invoice.

**Business Model: "plus optional website, onboarding, payments, analytics, and training add-ons"**
These add-ons are listed as revenue sources but have no pricing defined. "Variable" in the add-on pricing row is not investor-grade specificity. At minimum: website add-on ($49-99/mo), onboarding/migration fee (one-time $199-499 per gym), payments processing (percentage of member revenue). None of these are built in the first 12 months, so listing them as revenue sources creates false impressions for investors.

**GTM: "Niche content: Create practical owner content around retention, trial follow-up, attendance, youth programs, fight teams, and beginner onboarding"**
Good strategy but this is a non-trivial content effort. A 2-person team doing sales, engineering, and content marketing is unrealistic. Content should be batched and created during natural downtime (not competing with engineering time). One good "how to stop losing trials" article per month is better than five mediocre ones.

**GTM: "Referral loop: Offer founding gyms discounted plans or credits for introducing other gym owners"**
Not modeled in the financial plan. If a founding gym gets 1 month free per referral and successfully refers 2 gyms, that's 2 months of lost MRR per founding gym. With 5 founding gyms referring 2 each, that's $149 × 10 = $1,490 in lost MRR in the short term. This investment is worth it for acquisition, but it should appear in the cost model.

**Financial Model: "$0-$99 avg rev/gym/month during pilot validation"**
G1 Boxing should be paying from day 1, even at a founding member discount ($49/month). A free pilot gives G1 Boxing no incentive to make OxRound a priority. Paying customers — even at a steep discount — are qualitatively different partners: they give real feedback, they push for features, and they tell other gym owners "I pay for this and it works." A $0 customer is a beta tester. A $49/month customer is an early adopter. The financial model's "Pilot Validation" row of $0 revenue is fine for planning but the goal should be to charge G1 Boxing something from month 1.

**Financial Model: Churn is completely absent**
The model shows monotonic growth. But gym software churn is real — 2-5% monthly is typical for SMB vertical SaaS. At 3% monthly churn: to maintain 20 gyms, you need to add 0.6 new gyms/month just to stay flat. To grow from 20 to 50 gyms in 6 months, you need to add (50 - 20×(1-0.03)^6) / 6 ≈ 6.5 gyms/month. This is a significant sales throughput requirement that's invisible in the current model.

**Risk: "Building too much before revenue — Mitigation: Build only booking, check-in, trials, payment visibility, and coach/admin usage first"**
The mitigation is correct but inconsistent with the MVP scope in ARCHITECTURE.md which builds all of those things simultaneously. "Build only" should translate to explicit cuts: no class booking in MVP week 1, no lead pipeline in MVP month 1. The risk register says "build only X" but the architecture builds everything.

**Risk: "Technical co-founder capacity — Mitigation: Define commitment, vesting, roadmap, and fallback contractor budget"**
The fallback contractor budget in a $50k-$100k Lean Founder Build scenario is approximately $5,000-$10,000 (10% of $100k). A competent contractor in Canada costs $75-150/hour. That's 33-130 hours of contractor time — enough for 1-2 specific features, not a fallback for an entire product build. This mitigation is not realistic for the Lean Founder Build scenario.

**90-Day Plan: Month 1: "Interview 10 gym owners/coaches"**
This should be completed before month 1 of product building. Customer discovery is pre-product. If you're building an MVP while simultaneously discovering what to build, you risk reworking features you just built. These 10 interviews should ideally happen before writing a line of code, or at the very latest in parallel with Month 1 scaffolding/boilerplate work.

**90-Day Plan: Month 3: "Approach first 10 Quebec gyms; aim for 3 beta commitments"**
3 beta commitments from 10 approaches (30% conversion) within 3 months of a product that doesn't exist yet (except a demo) is aggressive. Gym owners will want to see the real product running at G1, not a Netlify demo. The realistic timeline: 3 beta commitments happen after G1 is live and you have real testimonials to share, which is likely month 3-4.

**Investor Thesis: "not to beat Mindbody feature-for-feature on day one; it is to become the operating layer for combat sports gyms"**
This is the right framing and is the strongest paragraph in the entire document. It should be the opening sentence, not the penultimate one. The entire document builds to this insight; invert the structure.

---

## PART 2: FORWARD DEPLOYMENT PLAN

---

### 2.1 Gym Data Typology Matrix

Before onboarding any gym, categorize them by their current state:

| Type | Data State | Member Count | Effort to Migrate | Approach |
|---|---|---|---|---|
| **A — Paper-only** | Paper sign-in, cash/e-transfer, WhatsApp for comms | < 50 | Low | Manual entry session with owner |
| **B — Spreadsheet** | Google Sheets or Excel member list, e-transfer tracking | 30-150 | Medium | CSV import with field mapping |
| **C — Partial CRM** | Using a basic tool (Glofox free, Google Forms) | 50-200 | Medium | Export + field mapping + manual cleanup |
| **D — Full CRM** | Mindbody, Wodify, PushPress (paying customer) | 100-300 | High | CRM API export + custom import script |
| **E — Hybrid chaos** | Some members in spreadsheet, some in WhatsApp, some in paper | Any | High | Discovery session → decompose into types above |

G1 Boxing is almost certainly **Type A or B**. Most independent boxing gyms in Quebec are **A** or **B**. This means the initial migration tooling only needs to handle Type A and B well. Types C and D can be handled manually at first — there aren't enough Mindbody-using boxing gyms in Quebec to justify building a full importer in the first 6 months.

---

### 2.2 Pre-Integration Discovery (for every new gym)

Before building anything in OxRound for a new gym, conduct a 45-minute discovery session. This is a customer success function, not a sales function — it happens after they've signed up.

**Discovery questionnaire:**

1. How many active members do you currently have?
2. How do you define "active"? (Anyone who paid this month? Anyone who trained in the last 30 days?)
3. Where is your current member list? (Phone contacts, spreadsheet, paper, memory)
4. What information do you have per member? (Name, phone, email, dob, emergency contact, photo)
5. How do you currently track attendance?
6. How do you currently charge for membership? (Monthly, drop-in, punch cards, annual)
7. How do members pay you? (Cash, e-transfer, card through Square, etc.)
8. Do you have liability waivers for members? Where are they stored?
9. Do you have different membership types? What are the names and prices?
10. Do you have coaches other than yourself? What do they need to see?
11. How do you currently communicate with members? (WhatsApp group, Instagram, email)
12. Do you have a class schedule? Is it fixed or does it change week to week?
13. Do you track youth/minor members separately?
14. What does your typical week look like in terms of classes offered?

Document the answers. This becomes the gym's **onboarding brief** that guides data setup.

---

### 2.3 Migration Playbook by Type

#### Type A — Paper Only

**Timeline:** 1 session (2-3 hours with owner)

**Process:**
1. Sit with the owner (in person or on video call with screen share).
2. Open OxRound CRM + owner's phone contacts or paper list side by side.
3. Manually create each member profile together, one by one. Ask for any missing data (email, dob).
4. For each member: set their membership plan, payment status (ask the owner: "has this person paid for this month?"), and join date.
5. Generate QR codes for all members (done automatically on creation).
6. Print QR card sheet for members who won't download the app immediately (see §2.5).
7. Create the class schedule in OxRound.
8. Set up the owner's announcement channels.
9. Walk the owner through deactivating a membership to confirm they understand the QR invalidation flow.

**What to skip:** Historical attendance data. Type A gyms have no historical records worth importing. Start fresh.

**What NOT to do:** Give the owner a spreadsheet template to fill out themselves. They won't do it. Do it with them.

---

#### Type B — Spreadsheet (Google Sheets / Excel)

**Timeline:** Pre-work 1-2 hours (by OxRound team), onboarding session 1 hour

**Pre-work:**
1. Ask the owner to share their spreadsheet.
2. Map columns to OxRound fields:

| Common Spreadsheet Column | OxRound Field |
|---|---|
| Name / Full Name | `profiles.first_name` + `profiles.last_name` |
| Phone / Cell | `profiles.phone` |
| Email | `auth.users.email` |
| Date of Birth / DOB | `profiles.date_of_birth` (needs adding to schema) |
| Membership Type / Plan | `membership_plans.name` |
| Start Date | `memberships.start_date` |
| Paid / Status | `memberships.payment_status` |
| Emergency Contact | `gym_members.emergency_contact` |
| Notes | `coach_notes.body` (initial coach note per member) |

3. Clean the data: remove duplicates, fill blanks with "unknown" or flag for owner to complete, normalize phone formats.
4. Run the CSV import (via a one-time import script or a CRM import UI feature — see below).

**Import UI requirement:** Build a CSV import wizard in the CRM (not MVP — Phase 2). Until then, use a one-time Node.js script that takes a cleaned CSV and calls Supabase's REST API to create profiles and gym_members in bulk. This should be written once and reused for every Type B gym.

**Import script spec:**
```
Input: CSV with columns [first_name, last_name, email, phone, plan_name, payment_status, start_date]
Output: Creates auth.users (generates temp password → magic link on first login),
        profiles, gym_members, memberships rows for each row
```

**Historical data:** Import attendance from spreadsheet only if the data is clean and consistently structured. Most gym spreadsheets have attendance tracked as "X" marks in date columns — parseable but messy. Import only if the owner specifically asks for it. Otherwise, start fresh and keep old spreadsheet archived.

---

#### Type C — Partial CRM (Glofox, Google Forms, etc.)

**Timeline:** 2-4 hours depending on data cleanliness

**Process:**
1. Export member list from current tool (most tools support CSV export).
2. Map to OxRound fields as in Type B.
3. Check for class booking history — import only if structured and complete.
4. Do NOT import billing history from the old system — OxRound's payment tracking starts fresh.
5. If current tool has waivers stored, export as PDF archive and store in Supabase Storage as `waivers/[gym_id]/[member_id]/waiver.pdf`. This is the paper trail.
6. Cancel old CRM subscription only after 2 weeks of running both in parallel.

**Critical parallel operation period:** Run both systems for 2 weeks. This catches any missed members, confirms the QR system works with the new setup, and gives the owner confidence before canceling the old system.

---

#### Type D — Full CRM (Mindbody, Wodify, PushPress)

**Timeline:** 1-2 weeks

**Process:**
1. Request data export from current CRM (most offer data portability — Mindbody and Wodify have CSV exports). Some CRMs charge a data export fee — warn the owner upfront.
2. Map member profiles, membership history, payment records, attendance history.
3. Write a one-time import script (customized per CRM format — each has different field naming).
4. Import members in bulk. Do NOT import class sessions or booking history unless the owner specifically needs it — historical booking data rarely matters to gym owners.
5. Import payment history only if the owner uses it for accounting (rare at boxing gym scale).
6. Run 4-week parallel period before disconnecting old system.

**Data you will NOT be able to import from Mindbody:**
- Stored payment methods (PCI compliance — cannot transfer card data)
- Liability waivers signed in Mindbody (export as PDFs, store in Supabase Storage)
- Class booking history older than 1 year (usually not worth importing)

**Owner communication:** The transition from Mindbody is the highest-stakes migration. Mindbody gyms have members who use the Mindbody app. Those members need to be notified to download the OxRound app. Send a gym-wide announcement 2 weeks before cutover, then 3 days before, then day-of. Expect 20-30% of members to need personal help with the transition.

---

#### Type E — Hybrid Chaos

**Timeline:** Discovery first (1 hour), then assign sub-types and execute in parallel.

The discovery session maps out which members are where. Typical finding: "My top 30 members I know by heart, another 20 are in my phone contacts, and I have a handwritten list of maybe 10 more." Treat the top 30 as Type A (do it together), the phone contacts as Type B (export to CSV via iPhone Contacts export), and the written list as Type A again.

---

### 2.4 Member App Activation Strategy

Getting members onto the app is the hardest part of deployment. Gym owners consistently overestimate how many members will download an app unprompted.

**The activation problem:** An owner posts in their WhatsApp group "please download our new app." Maybe 30% download it that day. Another 20% download it over the next 2 weeks. 50% never download it. At 50% adoption, the QR check-in system is broken because half the members can't check in.

**The solution stack:**

1. **QR card fallback:** Print individual QR code cards for every member (credit card sized). Hand-deliver at the gym the week before launch. Members who don't download the app can still check in by scanning the physical card. This removes the app adoption bottleneck from day 1.

2. **In-gym QR poster:** Post each member's QR code (name + QR) on a board inside the gym. Members scan from the board. Engagement-positive, no app needed. Remove once app adoption hits 70%+.

3. **Check-in incentive:** On first app check-in, member gets a "Welcome to OxRound" message visible on the kiosk screen. Simple acknowledgment, big motivation.

4. **Class booking gating:** Class booking is only available in the app (not via WhatsApp or phone call). This is the most powerful adoption driver — if you want to secure your spot in the Saturday sparring session, you need the app. Implement this in month 2 after the core flow is stable.

5. **Onboarding email sequence:** After the gym owner adds a member and the member receives their magic link / invite, the email should pre-explain: "Your gym now uses OxRound. Download the app to book classes, see your attendance, and get gym announcements." Deep link directly to the App Store / Play Store. One-click.

6. **Owner-led in-person activation session:** Schedule a 30-minute "app day" at the gym — all members invited to come 15 minutes before class. Team walks members through download and first login. This converts 60-80% in one session.

---

### 2.5 Kiosk Hardware Provisioning

The kiosk check-in requires a tablet at the gym entrance. This is an unmodeled operational cost and deployment dependency.

**Hardware options:**

| Option | Cost | Pros | Cons |
|---|---|---|---|
| OxRound-provided iPad (refurbished 9th gen) | ~$250-350 CAD one-time | Controlled setup, Guided Access configured, mounted | Capital cost, lost/damaged risk, owner doesn't value it |
| Owner's existing iPad | $0 | No cost | May be old, competing apps, not dedicated, needs Guided Access setup |
| Amazon Fire HD 10 | ~$130-180 CAD | Cheap, disposable | Android-only, lower quality camera for QR scanning |
| Wall-mounted Android kiosk | ~$150-200 CAD | Purpose-built, locked-down | Setup complexity, sourcing |

**Recommended approach (pilot phase):** If the gym owner has an existing iPad or Android tablet: use it. OxRound installs the app, configures Guided Access (iOS) or kiosk mode (Android), mounts with a cheap wall mount (~$30 on Amazon). Do not provide hardware during pilot — validate the concept first.

For Scale rollout: Consider offering a hardware + setup package as an optional add-on ($299 one-time includes iPad mini, wall mount, power supply, and setup). Or partner with a Canadian hardware reseller.

---

### 2.6 Ongoing Integration Touchpoints

After deployment, these ongoing integrations become friction points if not designed:

**E-Transfer payment recording:** Owners receive Interac e-transfer notifications via email or banking app. They need to mark corresponding members as paid in OxRound without switching between apps. The CRM needs a simple daily flow: "Mark payments received today" → shows members with upcoming or overdue billing → one-tap to mark paid with amount and method. This is not a bank API integration — it is a UI that makes manual logging as frictionless as possible.

**WhatsApp group migration:** Owners will not immediately abandon their WhatsApp group. They'll run both in parallel for 2-4 months. Design OxRound's announcement system to be objectively better: richer media, auto-translated to member language, pinned posts, read receipts. Over time the WhatsApp group atrophies. Don't try to kill it — let it die naturally.

**Instagram integration:** Many boxing gyms post fight announcements, member spotlights, and event promotions on Instagram. OxRound could ingest Instagram posts (via Instagram Basic Display API or simple IFTTT/Zapier bridge) as announcements. This is a low-effort integration that makes OxRound the aggregation point. Flag for Phase 3.

---

## PART 3: PRODUCT MAINTENANCE PLAN

---

### 3.1 Dependency & Security Maintenance

**Cadence:** Monthly dependency review, immediate patching for critical CVEs.

**Process:**
- Run `pnpm audit` weekly via GitHub Actions CI (add to the existing lint/typecheck workflow).
- Use Dependabot (or Renovate Bot) for automated dependency PRs. Configure Renovate to auto-merge patch updates that pass CI, and flag minor/major updates for manual review.
- Monitor Supabase changelog weekly — Supabase Pro sometimes pushes breaking changes to edge functions or PostgREST behavior with short notice.
- Monitor Expo SDK changelog — new SDK versions often require `expo-camera`, `expo-notifications`, and other native modules to be updated together. Never update Expo SDK without allocating a full day for regression testing on both iOS and Android.
- Subscribe to security advisories for: Next.js (critical SSR vulns have happened), React Native, Deno (Edge Functions runtime), and Supabase.

**Critical dependencies and their failure modes:**

| Dependency | Failure mode | Mitigation |
|---|---|---|
| Supabase Auth | Auth tokens invalid, login broken | Supabase status page alerting (Sentry uptime check on `/auth/v1/health`) |
| Expo EAS | Build/deploy blocked | Maintain last-known-good binary on TestFlight; OTA updates as primary hotfix path |
| Resend | Emails not delivered | Queued notifications in `notifications` table; retry on next pg_cron run |
| Expo Push | Push not delivered | Graceful degradation; in-app notification feed as fallback |
| Stripe | Billing blocked | No immediate user-facing impact; fix within 24 hours |

---

### 3.2 Database Maintenance

**Migrations:** Every schema change is a migration file in `supabase/migrations/`. No direct schema edits via Supabase Studio in production — all changes go through migration files reviewed in a PR. This is non-negotiable. Ad-hoc Studio edits in production create schema drift that's impossible to track and replicate.

**Backups:** Supabase Pro includes daily backups with 7-day retention. Download and verify a backup restoration monthly. Add Point-in-Time Recovery (PITR) at $100/month if daily backup granularity is insufficient — not needed until you have 20+ paying gyms.

**Indexes:** Review `EXPLAIN ANALYZE` output quarterly on the 5 most common queries (member list, check-in feed, attendance history, class schedule, lead pipeline). Add indexes where full table scans appear. The schema currently defines two indexes on `check_ins` — add similar indexes when query patterns emerge from PostHog/logs.

**Data retention:** Define and implement: check-in records older than 3 years → archive to cold storage or delete (depending on Quebec Law 25 requirements). Cancelled memberships → anonymize PII after 1 year. Former members → soft-delete with 2-year data hold for tax/legal purposes.

**pg_cron job monitoring:** pg_cron failures are silent by default. Create a `cron_job_log` table that each cron job writes to on start and completion. If a job's last success is more than 26 hours ago, trigger a Sentry alert. This is critical for membership expiry jobs and payment reminder emails.

---

### 3.3 Mobile App Maintenance

**App Store compliance:** Apple and Google update their developer policies regularly. Subscribe to Apple Developer Program announcements and Google Play Policy Center. Key ongoing requirements: privacy manifests (Apple requires this as of iOS 17+), minimum target SDK versions (Google requires minimum target SDK to be within 1 year of current), and permission usage descriptions.

**OTA vs binary update decision:** Use EAS Updates (OTA) for: bug fixes, UI changes, copy changes, new screens that don't require new native modules. Require a binary update (EAS Build → App Store review) for: new native modules (camera permissions, push notifications), app icon/name changes, major version bumps that Apple/Google require. In practice: OTA for all hotfixes and minor features (1-2 week cycle), binary update monthly or quarterly.

**OS version support policy:** Support current iOS and 1 major version back. As of 2026, that means iOS 17 and iOS 18. Drop iOS 16 support when less than 5% of active users are on it (visible in Expo's analytics). Same logic for Android — support Android 12 (API 31) and above; below this is less than 10% of Android devices globally.

**Versioning strategy:** 
- `MAJOR.MINOR.PATCH` format.
- MAJOR: significant feature releases (new tab in member app, new CRM section).
- MINOR: new features within existing sections.
- PATCH: bug fixes.
- Maintain version in `app.json` for the mobile app and `package.json` root. Tag every production release in git.
- Keep a `CHANGELOG.md` that owners can read to know what changed. Boxing gym owners don't read technical release notes — write changelog entries in plain language: "You can now see which coach is assigned to each class" not "Added coach_id display to ClassSessionCard component."

**Regression test checklist (run before every binary release):**
1. Fresh install on iOS — login via magic link works.
2. Fresh install on Android — login via magic link works.
3. QR code displays on member's phone — generates and renders.
4. Kiosk scan of member QR — check-in succeeds.
5. Class booking — can book, receives confirmation.
6. Class cancellation — removes booking.
7. Announcement — owner creates → member receives push notification → taps → opens announcement.
8. Membership deactivation — owner deactivates → member QR fails on kiosk → member sees inactive status in app.
9. Push notification opt-out — member disables notifications → no errors thrown.
10. Offline mode — app opens without internet → shows cached schedule → graceful "connection needed" message for actions requiring internet.

---

### 3.4 Monitoring & Incident Response

**Uptime monitoring:** Add Sentry uptime monitors (or a free UptimeRobot check) for:
- `app.oxround.com` (CRM) — alert if HTTP 200 not returned in 30 seconds
- Supabase API health endpoint — alert if `supabase.co/rest/v1/` returns non-200
- Edge Function check-in endpoint — alert if latency > 2 seconds

**Alerting:** All Sentry errors above threshold go to a dedicated Slack channel or email. Define thresholds: more than 5 errors/minute = P1 (page immediately), 1-5 errors/minute = P2 (notify within 1 hour), isolated errors = P3 (review daily).

**Incident response levels:**

| Level | Definition | Response Time | Action |
|---|---|---|---|
| P0 — System Down | Check-in broken or CRM inaccessible | < 30 minutes | Drop everything; hotfix OTA or rollback |
| P1 — Feature Broken | QR codes not generating, push not sending | < 2 hours | Hotfix OTA if possible |
| P2 — Degraded | Slow load times, occasional errors | < 24 hours | Fix in next deploy |
| P3 — Minor | UI bug, display error | < 1 week | Queue for next sprint |

**Communication:** For P0/P1 incidents, proactively message affected gym owners via email or WhatsApp before they notice. "We're aware of an issue with X and are fixing it — estimated resolution in 30 minutes." This prevents panicked owner calls and builds trust. Silence during an incident is the worst response.

**Post-incident:** After every P0/P1 incident, write a 1-paragraph post-mortem: what happened, what was the root cause, what is the fix, what prevents recurrence. Archive in a `INCIDENTS.md` file in the repo. This is valuable for investors and future team members.

---

### 3.5 Feature Development Process

**Release cadence:**
- Weeks 1-3: Build and test new features in development/staging.
- Week 4: Freeze features; only bug fixes. Deploy to production. Push OTA update.
- Monthly binary build for App Store if native changes are needed.

**Feature flags:** Implement feature flags from day 1 using a simple mechanism (a `feature_flags` jsonb column on the `gyms` table, checked client-side). This lets you: enable a new feature for G1 Boxing only while building it, roll out gradually to 10% of gyms, and kill a feature remotely without a redeploy. PostHog offers feature flags as part of their free tier — use it rather than building your own.

**Feedback loop:** After every feature release, send a 3-question in-app survey to gym owners:
1. "Did you notice the new [feature]?" (Yes/No)
2. "If yes, is it useful?" (1-5)
3. "What's the one thing you wish we'd fix or add?" (text)

This is not a PostHog funnel — it's a qualitative check. 10 gym owners × 3 questions every 4 weeks = 30 data points to guide the roadmap.

**What to build next — the prioritization rule:** The next feature to build is always the answer to: "what is causing the most support requests?" Track every support message the owners send. If 5 different gyms in one month ask "can I see which members haven't checked in this month?" that is the next feature. Build from support tickets, not from roadmap speculation.

---

### 3.6 Customer Support SLAs and Processes

**Support channels:** Email (hello@oxround.com or support@oxround.com) and WhatsApp (ironic, but that's where gym owners live). Do not build a ticket system in the first 12 months — use a shared Gmail inbox and label threads by gym name.

**Response time commitments:**
- Starter plan gyms: respond within 24 business hours.
- Pro plan gyms: respond within 8 business hours.
- Growth plan gyms: respond within 2 business hours + dedicated WhatsApp contact.

**Common support requests and scripted resolutions:**

1. "A member can't log in" → Check if their email is confirmed in Supabase Auth. Resend magic link.
2. "QR isn't working at the door" → Check `gym_members.status` — if inactive, explain. If active, check if the kiosk has internet connectivity.
3. "A member's class doesn't show up" → Check `class_sessions` for that date — was it generated? Was it canceled?
4. "I accidentally deactivated a member" → CRM "Archive" action is reversible — set `gym_members.status = 'active'`.
5. "Push notifications aren't arriving" → Check `push_tokens` for that member's device. If missing, member needs to re-log in to re-register token.

**Escalation path:** All support issues that require a code change go to GitHub Issues with label `customer-reported`. Link the gym and the member in the issue body. No untracked verbal commitments to "fix it next week."

---

### 3.7 Compliance Maintenance (Quebec/Canada)

**Quebec Law 25 (Act Respecting the Protection of Personal Information):**
- As of September 2023 (fully enforced), Law 25 requires: privacy impact assessments for new data collection, the right for individuals to request their data, the right to data deletion, a designated privacy officer, and mandatory breach notification within 72 hours.
- OxRound collects: name, email, phone, date of birth, attendance records, payment status, emergency contacts. All of this is personal information under Law 25.
- Action items: (1) Write a privacy policy. (2) Build a "download my data" feature (a CRM function that exports a member's data as JSON/CSV). (3) Build a "delete my account" flow. (4) Designate a privacy officer (one of the founders). (5) Add breach notification procedure to incident response plan.

**PIPEDA (federal):** In Quebec, Law 25 takes precedence over PIPEDA for provincially-regulated businesses. No additional action needed if Law 25 is complied with.

**Data residency:** Supabase US-East-1 (Virginia). Law 25 does not mandate Canadian data residency as of 2026, but it requires contractual protections when data is stored outside Quebec. Supabase's Data Processing Addendum (DPA) covers this. Sign it. Store a copy.

**Annual compliance review:** Every January: review Law 25 requirements for any legislative updates, audit data retention policies, confirm DPA with Supabase is current, and test the "delete my data" flow end-to-end.

---

### 3.8 The One Maintenance Risk That Will Actually Kill the Product

None of the above technical risks are the likely failure mode. The actual maintenance risk is **key-person dependency**: if the technical co-founder gets sick, burns out, or exits, the product stops receiving updates. Gym owners tolerate 2-3 months of stagnation before churning. The mitigation is not a backup engineer — it is comprehensive documentation and an architecture that allows a junior contractor to make isolated changes without understanding the whole system.

Document from day 1:
- Every Edge Function with a README explaining its inputs, outputs, and failure modes.
- Every Supabase migration with a comment explaining why the change was made.
- A `RUNBOOK.md` that covers: how to deploy a hotfix, how to roll back a bad OTA update, how to reset a stuck pg_cron job, how to onboard a new gym manually if the import script fails.
- Record a 10-minute Loom video walkthrough of the codebase for each major module. A contractor who inherits this can be productive within days instead of weeks.
