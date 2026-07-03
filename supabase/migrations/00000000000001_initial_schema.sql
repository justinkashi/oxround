-- OxRound initial schema
-- Source: ARCHITECTURE.md §4 with DECISIONS.md fixes applied:
--   D-02: check_in_token_hash (SHA-256), not bcrypt "qr_code"
--   D-03: no hard DELETE anywhere; soft-delete via status='archived'
--   D-04: profiles.date_of_birth
--   D-05: payment_status defaults 'pending', never 'unknown'
--   D-06: roles text[] instead of single role + UNIQUE(gym_id,user_id) kept
--   D-07: boxing fields collected now, surfaced Phase 3
-- Plus critique fixes: announcement_reads/reactions, 'attended' booking status,
--   check_ins.method enum, cron_job_log, notes -> coach_notes only.

-- ============ TENANTS & USERS ============

CREATE TABLE gyms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  slug               text UNIQUE NOT NULL,
  plan               text NOT NULL DEFAULT 'starter'
                     CHECK (plan IN ('starter','pro','growth')),
  plan_status        text NOT NULL DEFAULT 'trialing'
                     CHECK (plan_status IN ('trialing','active','past_due','canceled')),
  stripe_customer_id text,
  timezone           text NOT NULL DEFAULT 'America/Toronto',
  logo_url           text,
  address            text,
  phone              text,
  settings           jsonb NOT NULL DEFAULT '{}',  -- feature flags live here (D-13)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name     text,
  last_name      text,
  phone          text,
  avatar_url     text,
  date_of_birth  date,                              -- D-04
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gym_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES profiles(id),   -- nullable: member may not have an account yet
  first_name          text NOT NULL,                  -- denormalized so owner can create members pre-signup
  last_name           text,
  email               text,
  phone               text,
  roles               text[] NOT NULL DEFAULT '{member}',  -- D-06: owner|manager|coach|receptionist|member|trial
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','suspended','archived')),
  check_in_token_hash text UNIQUE,                    -- D-02: SHA-256 hex of raw token
  joined_at           date,
  emergency_contact   jsonb,                          -- { name, phone, relation }
  -- D-07: boxing-specific, collected Phase 1, surfaced Phase 3
  weight_class        text,
  skill_level         text,
  fight_record        jsonb,                          -- { wins, losses, draws }
  medical_notes       text,                           -- coach-visible only
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gym_id, user_id)
);
CREATE INDEX idx_gym_members_gym ON gym_members(gym_id, status);

-- ============ MEMBERSHIPS ============

CREATE TABLE membership_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id         uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name           text NOT NULL,
  kind           text NOT NULL DEFAULT 'recurring'
                 CHECK (kind IN ('recurring','drop_in','punch_card','family','trial','intro_offer')),
  price_cents    int,
  billing_period text CHECK (billing_period IN ('monthly','quarterly','annual', NULL)),
  max_classes    int,                                 -- kept in schema; NOT enforced in MVP (critique)
  is_active      bool NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id            uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  gym_member_id     uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  plan_id           uuid REFERENCES membership_plans(id),
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','expired','canceled')),
  payment_status    text NOT NULL DEFAULT 'pending'   -- D-05
                    CHECK (payment_status IN ('paid','pending','overdue','comped')),
  payment_method    text CHECK (payment_method IN ('cash','etransfer','card', NULL)),
  start_date        date NOT NULL,
  end_date          date,
  next_billing_date date,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_memberships_gym ON memberships(gym_id, status, payment_status);

-- Manual payment log (C7: invoice history, e-transfer daily flow)
CREATE TABLE payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id         uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  gym_member_id  uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  membership_id  uuid REFERENCES memberships(id),
  amount_cents   int NOT NULL,
  method         text NOT NULL CHECK (method IN ('cash','etransfer','card','other')),
  paid_at        date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by    uuid REFERENCES gym_members(id),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============ CLASSES & BOOKINGS ============

CREATE TABLE classes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  coach_id      uuid REFERENCES gym_members(id),
  day_of_week   int[],
  start_time    time NOT NULL,
  duration_mins int NOT NULL DEFAULT 60,
  capacity      int,
  location      text,
  color         text,
  is_active     bool NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE class_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  class_id      uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_date  date NOT NULL,
  start_time    time NOT NULL,
  duration_mins int NOT NULL,
  capacity      int,
  coach_id      uuid REFERENCES gym_members(id),
  status        text NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','canceled','completed')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_gym_date ON class_sessions(gym_id, session_date);

CREATE TABLE class_bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  session_id    uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  gym_member_id uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'booked'
                CHECK (status IN ('booked','canceled','waitlisted','attended','no_show')),  -- critique: attended
  booked_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, gym_member_id)
);

-- ============ CHECK-INS ============

CREATE TABLE check_ins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  gym_member_id uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  session_id    uuid REFERENCES class_sessions(id),
  method        text NOT NULL DEFAULT 'qr_kiosk'      -- critique: unambiguous enum
                CHECK (method IN ('qr_kiosk','qr_phone','manual_staff','manual_import')),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  device_id     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_check_ins_gym_date ON check_ins(gym_id, checked_in_at DESC);
CREATE INDEX idx_check_ins_member ON check_ins(gym_member_id, checked_in_at DESC);

-- ============ LEADS (Phase 2 — schema stubbed now) ============

CREATE TABLE leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  first_name          text NOT NULL,
  last_name           text,
  email               text,
  phone               text,
  source              text CHECK (source IN ('walk_in','referral','instagram','tiktok','facebook','youtube','website','fight_event','other', NULL)),
  status              text NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new','contacted','trial_scheduled','trialing','converted','lost')),
  assigned_to         uuid REFERENCES gym_members(id),
  captured_by         uuid REFERENCES gym_members(id),  -- critique: attribution
  trial_start         date,
  trial_end           date,
  follow_up_date      date,
  lost_reason         text,
  notes               text,
  converted_member_id uuid REFERENCES gym_members(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lead_activities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_id   uuid REFERENCES gym_members(id),
  type       text NOT NULL CHECK (type IN ('note','call','email','status_change','trial_class')),
  body       text,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ ANNOUNCEMENTS / COMMUNITY ============

CREATE TABLE announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  author_id    uuid NOT NULL REFERENCES gym_members(id),
  title        text NOT NULL,
  body         text,
  media_urls   text[],
  type         text NOT NULL DEFAULT 'general'
               CHECK (type IN ('general','schedule_change','event','fight','closure')),
  pinned       bool NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- critique: read receipts ("42 of 80 members saw this")
CREATE TABLE announcement_reads (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  gym_member_id   uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, gym_member_id)
);

-- critique: reactions keep community in-app instead of WhatsApp
CREATE TABLE announcement_reactions (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  gym_member_id   uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  emoji           text NOT NULL DEFAULT '👊',
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, gym_member_id)
);

-- ============ COACH NOTES (Phase 2 — stubbed) ============

CREATE TABLE coach_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES gym_members(id),
  body       text NOT NULL,
  visibility text NOT NULL DEFAULT 'coaches'
             CHECK (visibility IN ('coaches','owner_only','member_visible')),  -- critique: member_visible
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ NOTIFICATIONS ============

CREATE TABLE push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  platform   text NOT NULL CHECK (platform IN ('ios','android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES gym_members(id),      -- null = broadcast
  type         text NOT NULL CHECK (type IN
               ('announcement','reminder','membership_alert','membership_deactivated','check_in_confirm','booking_confirmed','class_canceled','waitlist_opened')),
  title        text NOT NULL,
  body         text,
  data         jsonb NOT NULL DEFAULT '{}',
  -- critique: token resolved from push_tokens at SEND time, never stored here
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts     int NOT NULL DEFAULT 0,               -- retry support (pg_cron has none natively)
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_pending ON notifications(status) WHERE status = 'pending';

-- ============ OPS ============

-- MAINTENANCE.md: pg_cron failures are silent — every job logs here; alert if stale >26h
CREATE TABLE cron_job_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name    text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  success     bool,
  detail      text
);
CREATE INDEX idx_cron_log_job ON cron_job_log(job_name, started_at DESC);

-- ============ updated_at trigger ============

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gyms','profiles','gym_members','memberships','leads','coach_notes','push_tokens']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
