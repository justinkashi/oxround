# OxRound — Architecture & Infrastructure Plan

> Combat-sports-first gym operating system. B2B SaaS targeting independent boxing/MMA/kickboxing gyms.
> Pilot: G1 Boxing, Vaudreuil-Dorion, QC.

---

## 0. Guiding Principles

1. **Multi-tenant from day one.** Every table is scoped by `gym_id`. Adding gym #2 requires zero schema changes.
2. **Lean stack, fast iteration.** Two-founder team. Pick managed services over self-hosted wherever possible.
3. **Mobile-first member experience.** QR check-in, bookings, and announcements must feel native, not like a web app pinned to a home screen.
4. **Security is non-negotiable.** Row-level security at the DB layer. No gym ever sees another gym's data — enforced by the database, not just application code.
5. **Build the MVP. Stub everything else.** Payments, analytics, website add-on are real eventual features — design the schema to support them, but don't build them in month 1.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│                                                             │
│  ┌──────────────────┐        ┌──────────────────────────┐  │
│  │   Member App     │        │   Owner/Coach CRM        │  │
│  │   (Expo/RN)      │        │   (Next.js web)          │  │
│  │   iOS + Android  │        │   app.oxround.com        │  │
│  └────────┬─────────┘        └────────────┬─────────────┘  │
└───────────┼──────────────────────────────-┼────────────────┘
            │ HTTPS + JWT                   │ HTTPS + JWT
            ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE                                │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Auth       │  │  PostgREST   │  │  Realtime        │  │
│  │  (JWT)      │  │  (REST API)  │  │  (check-in feed) │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PostgreSQL │  │  Storage     │  │  Edge Functions  │  │
│  │  + RLS      │  │  (media)     │  │  (QR, webhooks)  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                          │
│  Stripe (gym billing)  │  Resend (email)  │  Expo Push      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

### 2.1 Owner / Coach CRM — Web

| Layer                   | Choice                                           | Reason                                                                          |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Framework               | **Next.js 16** (App Router)                | Stable as of 2026; Pages Router is in maintenance mode. SSR for fast dashboard loads; Vercel-native. See STACK_REVIEW.md §2.2 |
| Language                | **TypeScript**                             | Type safety across shared models                                                |
| Styling                 | **Tailwind CSS + shadcn/ui**               | Fast UI, accessible components, consistent design system                        |
| State / data fetching   | **TanStack Query v5** + Supabase JS client | Optimistic updates, caching, realtime subscription hooks                        |
| Forms                   | **React Hook Form + Zod**                  | Validation colocated with schemas                                               |
| QR generation (display) | **qrcode.react**                           | Render member QR codes in browser                                               |
| Charts (future)         | **Recharts**                               | Lightweight, works in RSC boundary                                              |
| Deployment              | **Vercel**                                 | Zero-config Next.js, preview URLs per PR                                        |

### 2.2 Member App — Mobile

| Layer              | Choice                                            | Reason                                                                                         |
| ------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Framework          | **Expo (React Native)** — development builds (SDK 55+) | Ships iOS + Android from one codebase; dev builds are Expo's production recommendation since SDK 54; EAS Build + OTA updates |
| Language           | **TypeScript**                              | Shared types with backend                                                                      |
| Styling            | **NativeWind v4** (Tailwind for RN)         | Same design tokens as web CRM                                                                  |
| Navigation         | **Expo Router** (file-based)                | Mirrors Next.js patterns; deep linking built-in                                                |
| QR scanning        | **expo-camera** (`onBarcodeScanned`)        | expo-barcode-scanner is deprecated; expo-camera covers QR scan for kiosk mode                  |
| Push notifications | **expo-notifications** → APNs + FCM        | Announcements, booking reminders                                                               |
| Secure storage     | **expo-secure-store**                       | JWT token storage (not AsyncStorage)                                                           |
| OTA updates        | **Expo EAS Update**                         | Push bug fixes without App Store review                                                        |
| Deployment         | **EAS Build**                               | Cloud builds; TestFlight + Play beta                                                           |

### 2.3 Backend / Database

| Layer            | Choice                                                                    | Reason                                                                                            |
| ---------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Backend platform | **Supabase**                                                        | Managed Postgres + Auth + Realtime + Storage + Edge Functions in one — right-sized for lean team |
| Database         | **PostgreSQL 15** (via Supabase)                                    | Relational; RLS for multi-tenancy; full-text search                                               |
| Auth             | **Supabase Auth**                                                   | JWT with custom claims (gym_id, role); magic link + password; no rolling your own                 |
| API              | **PostgREST** (Supabase auto-API) + **Edge Functions** (Deno) | Auto-generated CRUD from schema; Edge Functions for business logic (QR validation, webhooks)      |
| Realtime         | **Supabase Realtime**                                               | WebSocket push for live check-in feed on owner dashboard                                          |
| File storage     | **Supabase Storage**                                                | Profile photos, announcement images                                                               |
| Background jobs  | **pg_cron** (Supabase extension)                                    | Membership expiry checks, reminder emails                                                         |

### 2.4 Infrastructure & External Services

| Service                             | Purpose                                                          |
| ----------------------------------- | ---------------------------------------------------------------- |
| **Vercel**                    | CRM hosting, CI/CD, preview deploys                              |
| **Supabase**                  | Everything backend — **`ca-central-1` (Montreal)**: closest to Quebec + Canadian data residency for Law 25 (STACK_REVIEW.md §2.1) |
| **EAS (Expo)**                | Mobile CI/CD, OTA updates                                        |
| **Stripe**                    | OxRound billing of gym owners ($99/$199/$299/mo)                 |
| **Resend**                    | Transactional email (welcome, reminders, trial follow-up alerts) |
| **GitHub Actions**            | Lint, type-check, test on PR                                     |
| **Sentry**                    | Error monitoring (both web and mobile)                           |
| **PostHog** (optional, later) | Product analytics, funnel tracking                               |

---

## 3. Multi-Tenancy Architecture

Every gym is a **tenant**. Isolation is enforced at the database layer via PostgreSQL Row Level Security — not in application code.

**Pattern:** Shared schema, `gym_id` foreign key on every tenant-scoped table + RLS policies.

### How auth claims flow:

1. User logs in → Supabase Auth issues JWT.
2. JWT contains custom claims: `{ "gym_id": "uuid", "role": "owner" | "coach" | "member" }`.
3. Every DB query automatically filtered by RLS policy: `WHERE gym_id = auth.jwt()->>'gym_id'`.
4. No cross-tenant data leakage possible even with a compromised API call.

### Setting custom claims:

A Supabase Edge Function runs after sign-in (auth hook) to inject `gym_id` and `role` into the JWT from the `gym_members` table.

---

## 4. Database Schema

> Conventions: all PKs are `uuid` with `gen_random_uuid()`, all tables have `created_at timestamptz DEFAULT now()` and `updated_at timestamptz`.

### 4.1 Tenant & User Tables

```sql
-- Gyms (tenants)
CREATE TABLE gyms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,           -- e.g. "g1boxing"
  plan            text NOT NULL DEFAULT 'starter', -- starter | pro | growth
  plan_status     text NOT NULL DEFAULT 'trialing',-- trialing | active | past_due | canceled
  stripe_customer_id text,
  timezone        text NOT NULL DEFAULT 'America/Toronto',
  logo_url        text,
  address         text,
  phone           text,
  settings        jsonb NOT NULL DEFAULT '{}',    -- future: theme, features flags
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Platform users (auth.users is Supabase's table; this extends it)
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name      text,
  last_name       text,
  phone           text,
  avatar_url      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Links a user to a gym with a role
CREATE TABLE gym_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            text NOT NULL,                  -- owner | coach | member | trial
  status          text NOT NULL DEFAULT 'active', -- active | inactive | suspended
  qr_code         text UNIQUE NOT NULL,           -- unique token for QR check-in
  joined_at       date,
  notes           text,                           -- internal owner notes
  emergency_contact jsonb,                        -- { name, phone, relation }
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(gym_id, user_id)
);
```

### 4.2 Membership & Billing

```sql
-- Membership plan definitions per gym
CREATE TABLE membership_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name            text NOT NULL,                  -- e.g. "Unlimited", "3x/week"
  price_cents     int,
  billing_period  text,                           -- monthly | quarterly | annual
  max_classes     int,                            -- null = unlimited
  is_active       bool NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- A member's active membership
CREATE TABLE memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  gym_member_id   uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  plan_id         uuid REFERENCES membership_plans(id),
  status          text NOT NULL DEFAULT 'active', -- active | paused | expired | canceled
  payment_status  text NOT NULL DEFAULT 'unknown',-- paid | overdue | unknown | comped
  start_date      date NOT NULL,
  end_date        date,
  next_billing_date date,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### 4.3 Classes & Bookings

```sql
-- Recurring class templates
CREATE TABLE classes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name            text NOT NULL,                  -- "Morning Boxing", "Youth Program"
  description     text,
  coach_id        uuid REFERENCES gym_members(id),
  day_of_week     int[],                          -- 0=Sun .. 6=Sat
  start_time      time NOT NULL,
  duration_mins   int NOT NULL DEFAULT 60,
  capacity        int,                            -- null = unlimited
  location        text,
  is_active       bool NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Specific class sessions (generated from template or created ad-hoc)
CREATE TABLE class_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  class_id        uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_date    date NOT NULL,
  start_time      time NOT NULL,
  duration_mins   int NOT NULL,
  capacity        int,
  coach_id        uuid REFERENCES gym_members(id),
  status          text NOT NULL DEFAULT 'scheduled', -- scheduled | canceled | completed
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- Member class bookings
CREATE TABLE class_bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  gym_member_id   uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'booked',  -- booked | canceled | waitlisted | no_show
  booked_at       timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(session_id, gym_member_id)
);
```

### 4.4 Attendance / Check-Ins

```sql
-- Every time a member checks in
CREATE TABLE check_ins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  gym_member_id   uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES class_sessions(id),  -- null = open gym
  method          text NOT NULL DEFAULT 'qr',          -- qr | manual | kiosk
  checked_in_at   timestamptz DEFAULT now(),
  device_id       text,                                -- optional: which tablet/kiosk
  created_at      timestamptz DEFAULT now()
);

-- Index for attendance dashboard queries
CREATE INDEX idx_check_ins_gym_date ON check_ins(gym_id, checked_in_at DESC);
CREATE INDEX idx_check_ins_member ON check_ins(gym_member_id, checked_in_at DESC);
```

### 4.5 Leads / Trial Pipeline (CRM)

```sql
-- Prospect / trial pipeline (not yet full members)
CREATE TABLE leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  first_name      text NOT NULL,
  last_name       text,
  email           text,
  phone           text,
  source          text,                           -- walk-in | referral | instagram | website
  status          text NOT NULL DEFAULT 'new',    -- new | contacted | trial_scheduled | trialing | converted | lost
  assigned_to     uuid REFERENCES gym_members(id),-- coach/owner handling this lead
  trial_start     date,
  trial_end       date,
  follow_up_date  date,
  lost_reason     text,
  notes           text,
  converted_member_id uuid REFERENCES gym_members(id), -- set when status = converted
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Activity log per lead
CREATE TABLE lead_activities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES gym_members(id),
  type            text NOT NULL,                  -- note | call | email | status_change | trial_class
  body            text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);
```

### 4.6 Announcements / Community

```sql
-- Owner/coach posts visible to members
CREATE TABLE announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES gym_members(id),
  title           text NOT NULL,
  body            text,
  media_urls      text[],                         -- Supabase Storage URLs
  type            text NOT NULL DEFAULT 'general',-- general | schedule_change | event | fight | closure
  pinned          bool NOT NULL DEFAULT false,
  published_at    timestamptz DEFAULT now(),
  expires_at      timestamptz,                    -- auto-archive
  created_at      timestamptz DEFAULT now()
);
```

### 4.7 Coach Notes

```sql
-- Coach notes on individual members
CREATE TABLE coach_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES gym_members(id),
  body            text NOT NULL,
  visibility      text NOT NULL DEFAULT 'coaches',-- coaches | owner_only
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### 4.8 Notifications

```sql
-- Push notification queue / log
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  recipient_id    uuid REFERENCES gym_members(id), -- null = broadcast to gym
  type            text NOT NULL,                   -- announcement | reminder | membership_alert | check_in_confirm
  title           text NOT NULL,
  body            text,
  data            jsonb DEFAULT '{}',
  expo_push_token text,
  status          text NOT NULL DEFAULT 'pending', -- pending | sent | failed
  sent_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Store device push tokens
CREATE TABLE push_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE,
  platform        text NOT NULL,                  -- ios | android
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

---

## 5. Row Level Security (RLS) Policies

All tables have RLS enabled. The pattern is consistent:

```sql
-- Example: gym_members table
ALTER TABLE gym_members ENABLE ROW LEVEL SECURITY;

-- Owners/coaches can see all members in their gym
CREATE POLICY "gym staff see members" ON gym_members
  FOR SELECT USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
    AND (auth.jwt() ->> 'role') IN ('owner', 'coach')
  );

-- Members can only see their own record
CREATE POLICY "members see self" ON gym_members
  FOR SELECT USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
    AND user_id = auth.uid()
  );

-- Only owners can update membership status
CREATE POLICY "owner manages members" ON gym_members
  FOR ALL USING (
    gym_id = (auth.jwt() ->> 'gym_id')::uuid
    AND (auth.jwt() ->> 'role') = 'owner'
  );
```

The same `gym_id = (auth.jwt() ->> 'gym_id')::uuid` predicate applies to every table. Cross-gym data access is structurally impossible at the database level.

---

## 6. Authentication & Role Flow

### Roles

- `owner` — full access: members, billing, settings, all CRM data
- `coach` — access: member profiles, check-ins, class management, coach notes, announcements. No billing.
- `member` — access: own profile, class schedule, bookings, announcements, own attendance
- `trial` — like member but no booking (can only walk in); owner can convert to member

### Auth Flow

```
1. User opens app / CRM
2. Enters email → Supabase sends magic link OR password login
3. Supabase Auth issues JWT (HS256, 1h expiry, refresh token stored in expo-secure-store / httpOnly cookie)
4. Auth hook Edge Function runs:
   - Reads gym_members for this user
   - Injects { gym_id, role } into JWT custom claims
5. All subsequent requests carry JWT → RLS policies enforce access
```

### QR Check-in Token

- `gym_members.qr_code` is a cryptographically random 32-byte token (UUID v4 or `nanoid`), generated at member creation, stored hashed (bcrypt) server-side, raw value encoded in the QR image.
- **Check-in flow:**
  1. Gym kiosk (tablet running member app in "kiosk mode") opens camera
  2. Scans QR code → sends raw token to Edge Function `/functions/v1/check-in`
  3. Edge Function: validates token against `gym_members.qr_code`, checks membership status, checks for duplicate scan within 1h window, writes `check_ins` row
  4. Returns `{ success, member_name, membership_status }`
  5. Supabase Realtime broadcasts to owner dashboard (`check_ins` table channel)
  6. Owner sees live check-in feed update without refresh

---

## 7. API Design

### Pattern

Use Supabase's auto-generated PostgREST API for standard CRUD (`/rest/v1/`). Write custom **Edge Functions** (Deno/TypeScript) only for:

- Business logic that can't be done safely client-side
- Webhooks (Stripe, etc.)
- Third-party integrations

### Edge Functions

| Function              | Trigger                         | Purpose                                                   |
| --------------------- | ------------------------------- | --------------------------------------------------------- |
| `check-in`          | POST`/functions/v1/check-in`  | Validate QR token, write check_in row, return member info |
| `auth-hook`         | Supabase auth hook (post-login) | Inject gym_id + role into JWT claims                      |
| `notify-broadcast`  | Internal call                   | Send Expo push to all gym members                         |
| `membership-expiry` | pg_cron daily                   | Find expiring memberships, update status, send alerts     |
| `stripe-webhook`    | Stripe → POST                  | Handle subscription events, update gym plan_status        |
| `qr-rotate`         | POST (owner-triggered)          | Invalidate and regenerate a member's QR code              |

---

## 8. CRM Frontend Architecture (Next.js)

### Route Structure

```
app/
├── (auth)/
│   ├── login/                   # email + magic link
│   └── invite/[token]/          # owner invites coach
├── (dashboard)/
│   ├── layout.tsx               # sidebar nav, auth guard
│   ├── dashboard/               # overview: check-in feed, stats
│   ├── members/
│   │   ├── page.tsx             # member list
│   │   └── [id]/page.tsx        # member profile: notes, attendance, membership
│   ├── leads/
│   │   └── page.tsx             # Kanban pipeline: new → trial → converted
│   ├── classes/
│   │   ├── page.tsx             # schedule view
│   │   └── [id]/page.tsx        # session detail: attendance, bookings
│   ├── announcements/
│   │   └── page.tsx             # create/manage posts
│   └── settings/
│       ├── gym/                 # gym profile, logo, timezone
│       ├── plans/               # membership plan definitions
│       ├── billing/             # OxRound subscription (Stripe portal)
│       └── team/                # coach invites
└── api/                         # minimal Next.js API routes (mostly proxied to Supabase)
```

### Key UI Components

- **Live check-in feed** — Supabase Realtime subscription on `check_ins`, shows last 20 check-ins with member name + time. Updates without refresh.
- **Member list** — searchable, filterable by status/plan/payment. Bulk actions (deactivate, send announcement).
- **Lead pipeline** — drag-and-drop Kanban (or table view). Status transitions logged to `lead_activities`. Follow-up date shown as calendar.
- **Attendance heatmap** (future) — shows attendance patterns per member.

---

## 9. Member App Architecture (Expo)

### Screen Structure

```
app/
├── (auth)/
│   ├── index.tsx                # welcome screen
│   └── verify.tsx               # magic link / OTP verify
├── (tabs)/
│   ├── _layout.tsx              # bottom tab bar
│   ├── home.tsx                 # upcoming classes + announcements feed
│   ├── schedule.tsx             # weekly class schedule, book/cancel
│   ├── check-in.tsx             # my QR code (full screen for scanning)
│   ├── profile.tsx              # profile, membership status, attendance history
│   └── announcements/
│       ├── index.tsx            # announcement list
│       └── [id].tsx             # announcement detail
└── kiosk.tsx                    # kiosk mode: camera scan (no nav, full screen)
```

### Member Check-in (Self + Kiosk)

**Self check-in (not recommended for G1 — prone to fraud):** member shows QR on screen, coach scans with their phone.

**Kiosk mode (recommended):** iPad/tablet mounted at gym entrance runs the app in `kiosk.tsx` — locked to camera view. Members walk up, hold phone QR to tablet camera. No login required on the kiosk; the kiosk authenticates with a service role token scoped to that gym.

### Push Notifications

- Expo Notifications handles token registration.
- On login, `push_tokens` table is upserted with current Expo push token.
- Announcements trigger: owner publishes → Edge Function `notify-broadcast` → Expo Push API batch send.
- Reminder flow (future): pg_cron identifies class bookings 1h before session → notification queue.

---

## 10. Deployment & Infrastructure

### Environments

| Environment     | Purpose                                | Hosting                          |
| --------------- | -------------------------------------- | -------------------------------- |
| `development` | Local dev with Supabase CLI + local DB | localhost                        |
| `preview`     | Per-PR preview, Supabase branch DB     | Vercel Preview + Supabase Branch |
| `production`  | Live product                           | Vercel + Supabase Pro            |

### CI/CD Pipeline (GitHub Actions)

```yaml
On PR:
  - Type check (tsc --noEmit)
  - Lint (eslint)
  - Unit tests (vitest)
  - Supabase DB diff (detect schema drift)
  - Vercel preview deploy (automatic)

On merge to main:
  - All above
  - Supabase migration apply (supabase db push)
  - Vercel production deploy
  - EAS Update (OTA push to member app)

On tag (vX.Y.Z):
  - EAS Build (new binary → TestFlight / Play beta)
```

### Infrastructure Cost (at pilot scale)

| Service         | Plan                                       | Monthly Cost            |
| --------------- | ------------------------------------------ | ----------------------- |
| Supabase        | Pro ($25/mo) | ~$25                        |                         |
| Vercel          | Pro ($20/mo) | ~$20                        |                         |
| Expo EAS        | Free tier → Starter ($19) → Production ($199) | $0–$199 |                         |
| Resend          | Free (3,000 emails; 100/day cap)           | $0                      |
| Sentry          | Developer (free) during pilot → Team ($26) | $0–$26                  |
| Stripe          | 2.9% + $0.30 per transaction               | ~$3–$9/gym/mo           |
| **Total** |                                            | **~$50–$150/mo** |

At $99–$199/mo per gym, margin is strong even at 1–3 gyms.

---

## 11. Security Architecture

### Authentication

- JWTs are short-lived (1 hour) with rotating refresh tokens.
- Magic link is the default auth method — no password to phish/leak.
- Supabase handles token refresh automatically.

### Data Isolation

- RLS on every table. `gym_id` claim in JWT is the enforcement boundary.
- Service role key (full DB access) is only used in Edge Functions server-side, never shipped to clients.
- Anon key (public) is safe to ship — RLS blocks everything without a valid JWT.

### QR Code Security

- QR token is a random 128-bit value (nanoid or UUID).
- Stored hashed in DB (bcrypt). Raw value only in the QR image.
- Duplicate scan detection: same member can't check in twice within a 1-hour window (Edge Function check).
- Owners can rotate a member's QR from the CRM if it's suspected compromised.

### API Security

- All PostgREST calls require a valid JWT (enforced by Supabase).
- Edge Functions validate JWT before processing any request.
- Rate limiting: Supabase Pro includes basic rate limiting; add Cloudflare in front for DDoS protection if needed.

### Secrets Management

- All env vars stored in Vercel environment variables (encrypted at rest).
- Supabase secrets stored in Supabase Edge Function secrets vault.
- Never committed to git. `.env.local` for local dev, `.env.example` checked in with placeholder values.

### Compliance (Canada)

- Supabase offers a **Canada Central (`ca-central-1`, Montreal)** region — use it. Keeps member PII in Canada, reducing (not eliminating) the Law 25 cross-border transfer assessment burden; Supabase remains a US company, so sign the DPA and record a transfer impact assessment.
- Member data: name, email, phone, attendance. No health data in MVP. PIPEDA applies.
- Retention policy: define data deletion on membership cancellation in settings.

---

## 12. Feature-by-Feature Implementation Map

### MVP (0–3 months — G1 Boxing pilot)

| Feature                             | Implementation                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| **Auth (owner/coach/member)** | Supabase Auth magic link; auth hook injects role                                              |
| **Member profiles**           | `gym_members` + `profiles` tables; CRUD in CRM                                            |
| **QR check-in**               | `check-in` Edge Function; kiosk mode in member app                                          |
| **Attendance log**            | `check_ins` table; CRM dashboard with Realtime feed                                         |
| **Class schedule**            | `classes` + `class_sessions` tables; weekly view in app                                   |
| **Class booking**             | `class_bookings` CRUD; capacity enforcement in Edge Function                                |
| **Membership status**         | `memberships` table; owner toggles `status` + `payment_status`                          |
| **Membership deactivation**   | Owner sets`gym_members.status = 'inactive'`; QR becomes invalid (Edge Function checks this) |
| **Announcements**             | `announcements` table; owner creates post → Expo push broadcast                            |
| **Basic member app**          | Home (feed + next class), Schedule, My QR, Profile                                            |

### Paid Beta (3–6 months)

| Feature                        | Implementation                                                |
| ------------------------------ | ------------------------------------------------------------- |
| **Lead/trial pipeline**  | `leads` + `lead_activities`; Kanban in CRM                |
| **Coach notes**          | `coach_notes` table; visible on member profile page         |
| **Follow-up reminders**  | pg_cron + email via Resend when`follow_up_date` is today    |
| **Attendance dashboard** | Aggregate queries on`check_ins`; charts per member/class    |
| **Onboarding flow**      | Guided CRM setup wizard for new gyms                          |
| **Coach invite**         | Owner sends invite link; invitee signs up with`role: coach` |

### Quebec Rollout (6–12 months)

| Feature                     | Implementation                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------- |
| **Payment tracking**  | Extended`memberships` with Stripe payment links or manual e-transfer logging        |
| **Reporting**         | Monthly PDF/CSV export: attendance, revenue, retention                                |
| **Multi-gym support** | Already supported in schema — UI for gym switcher                                    |
| **Website add-on**    | Embeddable JS widget (class schedule, trial booking form) → writes to`leads` table |

---

## 13. Monorepo Structure

```
oxround/
├── apps/
│   ├── web/                     # Next.js CRM (owner/coach)
│   └── mobile/                  # Expo member app
├── packages/
│   ├── db/                      # Supabase schema, migrations, types
│   │   ├── migrations/
│   │   └── types/               # generated TypeScript types (supabase gen types)
│   ├── ui/                      # shared component library (future)
│   └── config/                  # shared eslint, tsconfig, tailwind preset
├── supabase/
│   ├── functions/               # Edge Functions
│   │   ├── check-in/
│   │   ├── auth-hook/
│   │   └── notify-broadcast/
│   ├── migrations/
│   └── config.toml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── package.json                 # pnpm workspace root
└── turbo.json                   # Turborepo config
```

**Package manager:** pnpm workspaces + Turborepo for caching builds across packages.

---

## 14. What NOT to Build in MVP

These are stubbed (data model exists) but not built:

- **Stripe payment processing for members** — owners manually mark payment status. Stripe integration is only for OxRound billing of gyms.
- **Analytics dashboard** — beyond basic attendance counts.
- **Website add-on** — planned post-10-gym mark.
- **Fight camp / training modules** — Phase 4.
- **Multi-location** — schema supports it (`gym_id`), UI deferred.
- **Social / community feed** — announcements cover this; full community feed is later.

---

## 15. Open Decisions (Resolve Before Build)

| Decision                             | Options                              | Recommendation                                                                                     |
| ------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Member app distribution during pilot | TestFlight only vs. public App Store | TestFlight for pilot (faster, no review); submit to stores in month 2                              |
| QR check-in device                   | Shared iPad kiosk vs. coach phone    | iPad kiosk at entrance — better UX, avoids borrowing phones                                       |
| Email auth vs. phone/OTP             | Email magic link vs. SMS OTP         | Email for now (free via Resend); SMS via Twilio when Quebec gyms need it (many members prefer SMS) |
| Supabase region                      | ~~US East vs. EU~~ **RESOLVED**      | `ca-central-1` (Montreal) — closest to Quebec AND Canadian residency for Law 25 (STACK_REVIEW.md)  |
| Shared or per-gym Supabase project   | One project (shared) vs. per-gym     | One shared project with RLS — simpler ops until 100+ gyms                                         |
