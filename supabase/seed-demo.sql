-- ============================================================================
-- DEMO-INSTANCE SEED — for the demo-oxround Supabase project ONLY.
-- ============================================================================
-- Wipes the database and restores the known-good demo state: one fictional gym
-- ("OxRound Boxing Club") with realistic members, payments, classes, check-ins,
-- leads, announcements and messages. All dates are relative to today, so the
-- demo always looks fresh.
--
-- Run it before every demo (Supabase dashboard → SQL editor → paste → run),
-- or: psql "$DEMO_DB_URL" -f supabase/seed-demo.sql
--
-- Safe to re-run any time. The demo owner login (demo@oxround.com) is created
-- once and survives re-seeding.
-- ============================================================================

-- ---- SAFETY GUARD: never run against a database holding real gym data ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM gyms WHERE slug <> 'oxround-demo') THEN
    RAISE EXCEPTION 'REFUSING TO RUN: this database contains a non-demo gym. This seed is for the demo-oxround project only.';
  END IF;
END $$;

-- ---- wipe (auth users + profiles survive; all gym data goes) ----
TRUNCATE TABLE gyms CASCADE;
TRUNCATE TABLE cron_job_log;

-- ---- demo owner login: demo@oxround.com / OxRoundDemo2026! (created once) ----
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'demo@oxround.com';
  IF uid IS NULL THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'demo@oxround.com', extensions.crypt('OxRoundDemo2026!', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"first_name":"Alex","last_name":"Martin"}', now(), now(), '', '', '', '');
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid, uid,
      jsonb_build_object('sub', uid::text, 'email', 'demo@oxround.com', 'email_verified', true),
      'email', now(), now(), now());
  END IF;
END $$;

-- ---- the fictional gym ----
INSERT INTO gyms (id, name, slug, timezone, address, phone, email, hours, cancellation_policy_hours)
VALUES ('00000000-0000-0000-0000-000000000001', 'OxRound Boxing Club', 'oxround-demo',
        'America/Toronto', '456 Rue du Ring, Montréal, QC', '514-555-0100',
        'info@oxroundboxing.example', 'Mon-Fri 6:30-21:00 · Sat 9:00-14:00 · Sun 11:00-13:00', 12);

-- ---- people (owner Alex + 6 members/coaches; created_at = join date so the
--       auto-logged "Joined the gym" timeline events land on the right day) ----
INSERT INTO gym_members (id, gym_id, user_id, first_name, last_name, email, phone, date_of_birth,
                         roles, status, invite_status, joined_at, emergency_contact,
                         weight_class, skill_level, availability, created_at)
VALUES
('00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000001',
 (SELECT id FROM auth.users WHERE email='demo@oxround.com'),
 'Alex','Martin','demo@oxround.com','514-555-0100',NULL,'{owner}','active','active','2024-01-15',NULL,NULL,NULL,NULL,'2024-01-15'),
('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001',NULL,
 'Marco','Silva','marco@example.com','514-555-0101','1998-04-12','{member}','active','not_invited','2025-09-01',
 '{"name":"Ana Silva","phone":"514-555-0111","relation":"spouse"}','Welterweight','Amateur',NULL,'2025-09-01'),
('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001',NULL,
 'Leila','Tremblay','leila@example.com','514-555-0102','1995-08-24','{member}','active','not_invited','2025-11-15',
 NULL,'Lightweight','Beginner',NULL,'2025-11-15'),
('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000001',NULL,
 'Dave','Nguyen','dave@example.com','514-555-0103','1991-02-03','{member}','active','not_invited','2026-01-10',
 NULL,'Middleweight','Open',NULL,'2026-01-10'),
('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000001',NULL,
 'Sophie','Gagnon','sophie@example.com','514-555-0104','1989-11-19','{coach,member}','active','not_invited','2024-06-01',
 NULL,'Featherweight','Elite',
 '[{"day":1,"start":"17:00","end":"21:00"},{"day":3,"start":"17:00","end":"21:00"},{"day":6,"start":"09:00","end":"12:00"}]','2024-06-01'),
('00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-000000000001',NULL,
 'Tony','Bélanger','tony@example.com','514-555-0106','1982-12-05','{coach}','active','not_invited','2025-02-01',
 NULL,NULL,'Pro',
 '[{"day":2,"start":"06:30","end":"09:00"},{"day":4,"start":"06:30","end":"09:00"},{"day":5,"start":"18:00","end":"21:00"}]','2025-02-01');

-- Karim joined recently (keeps the "New this month" stat alive forever)
INSERT INTO gym_members (id, gym_id, first_name, last_name, email, phone, date_of_birth,
                         roles, status, invite_status, joined_at, weight_class, skill_level, created_at)
VALUES
('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000001',
 'Karim','Haddad','karim@example.com','514-555-0105','2001-06-30','{member}','active','not_invited',
 current_date - 12,'Heavyweight','Beginner',(current_date - 12)::timestamptz);

-- ---- membership plans ----
INSERT INTO membership_plans (id, gym_id, name, kind, price_cents, billing_period, max_classes, is_active) VALUES
('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000001','Unlimited Monthly','recurring',12000,'monthly',NULL,true),
('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000001','Annual (2 months free)','recurring',120000,'annual',NULL,true),
('00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000001','10-Class Punch Card','punch_card',15000,NULL,10,true),
('00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000001','Drop-in','drop_in',2000,NULL,1,true),
('00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000001','Family (2+)','family',20000,'monthly',NULL,true),
('00000000-0000-0000-0000-000000000306','00000000-0000-0000-0000-000000000001','Free Trial Week','trial',0,NULL,3,true),
('00000000-0000-0000-0000-000000000307','00000000-0000-0000-0000-000000000001','Staff','recurring',0,NULL,NULL,false);

-- ---- memberships (Dave overdue = the at-risk/revenue story) ----
INSERT INTO memberships (gym_id, gym_member_id, plan_id, status, payment_status, payment_method, start_date, next_billing_date) VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000301','active','paid','etransfer','2025-09-01',current_date + 14),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000301','active','paid','cash','2025-11-15',current_date + 10),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000301','active','overdue','etransfer','2026-01-10',current_date - 6),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000307','active','comped',NULL,'2024-06-01',NULL),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000303','active','pending','cash',current_date - 12,current_date + 2);

-- ---- 60 days of check-ins (attendance curves: Marco 3x/wk, Leila 2x/wk,
--       Dave dropped off ~25 days ago → at-risk, Karim recent only) ----
INSERT INTO check_ins (gym_id, gym_member_id, method, checked_in_at)
SELECT '00000000-0000-0000-0000-000000000001',
       CASE w.who WHEN 'marco' THEN '00000000-0000-0000-0000-000000000101'::uuid
                  WHEN 'leila' THEN '00000000-0000-0000-0000-000000000102'::uuid
                  WHEN 'dave'  THEN '00000000-0000-0000-0000-000000000103'::uuid
                  ELSE '00000000-0000-0000-0000-000000000105'::uuid END,
       'qr_kiosk',
       (current_date - d)::timestamptz + make_interval(hours => w.h)
FROM generate_series(0, 60) d
CROSS JOIN (VALUES ('marco',7),('leila',18),('dave',19),('karim',17)) AS w(who,h)
WHERE (w.who = 'marco' AND d % 2 = 0)
   OR (w.who = 'leila' AND d % 3 = 0)
   OR (w.who = 'dave'  AND d > 25 AND d % 2 = 0)
   OR (w.who = 'karim' AND d < 12 AND d % 3 = 0);

-- ---- classes ----
INSERT INTO classes (id, gym_id, name, description, coach_id, day_of_week, start_time, duration_mins, capacity, location, color, is_active) VALUES
('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000001','Boxing Fundamentals','Stance, jab, cross, footwork. All levels.','00000000-0000-0000-0000-000000000104','{1,3}','18:00',60,16,'Main floor','red',true),
('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000001','Sparring (invite)','Coach-approved members only. Full gear.','00000000-0000-0000-0000-000000000106','{5}','19:00',90,10,'Ring','purple',true),
('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000001','Conditioning','Rope, bags, circuits.','00000000-0000-0000-0000-000000000106','{2,4}','07:00',45,20,'Main floor','blue',true),
('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000001','Youth Boxing (8-14)','Technique + games, no contact.','00000000-0000-0000-0000-000000000104','{6}','10:00',60,12,'Main floor','green',true),
('00000000-0000-0000-0000-000000000205','00000000-0000-0000-0000-000000000001','Open Gym','Bags and ring open, coach on site.',NULL,'{0}','11:00',120,NULL,'Whole gym','yellow',true);

-- ---- sessions: last week + this week + next week, from the class templates ----
INSERT INTO class_sessions (gym_id, class_id, session_date, start_time, duration_mins, capacity, coach_id, status)
SELECT c.gym_id, c.id, d::date, c.start_time, c.duration_mins, c.capacity, c.coach_id,
       CASE WHEN d::date < current_date THEN 'completed' ELSE 'scheduled' END
FROM classes c
CROSS JOIN generate_series(date_trunc('week', current_date)::date - 7,
                           date_trunc('week', current_date)::date + 13,
                           interval '1 day') d
WHERE extract(dow FROM d)::int = ANY(c.day_of_week);

-- ---- bookings: next Fundamentals session nearly full + waitlist; past session history ----
WITH next_fund AS (
  SELECT id FROM class_sessions
  WHERE class_id = '00000000-0000-0000-0000-000000000201' AND session_date >= current_date
  ORDER BY session_date LIMIT 1
), past_any AS (
  SELECT id FROM class_sessions
  WHERE session_date < current_date
  ORDER BY session_date DESC LIMIT 1
)
INSERT INTO class_bookings (gym_id, session_id, gym_member_id, status, booked_at)
SELECT '00000000-0000-0000-0000-000000000001', s.id, m.member, m.status, now() - interval '1 day'
FROM (
  SELECT '00000000-0000-0000-0000-000000000101'::uuid AS member, 'booked'     AS status, 'next' AS which UNION ALL
  SELECT '00000000-0000-0000-0000-000000000102',        'booked',     'next' UNION ALL
  SELECT '00000000-0000-0000-0000-000000000105',        'waitlisted', 'next' UNION ALL
  SELECT '00000000-0000-0000-0000-000000000101',        'attended',   'past' UNION ALL
  SELECT '00000000-0000-0000-0000-000000000103',        'no_show',    'past'
) m
JOIN LATERAL (
  SELECT id FROM next_fund WHERE m.which = 'next'
  UNION ALL
  SELECT id FROM past_any WHERE m.which = 'past'
) s ON true;

-- ---- 4 months of payments (Dave stopped paying = overdue story) ----
INSERT INTO payments (gym_id, gym_member_id, amount_cents, method, paid_at, recorded_by, notes, created_at)
SELECT '00000000-0000-0000-0000-000000000001', p.member, p.cents, p.method,
       current_date - p.days_ago, '00000000-0000-0000-0000-000000000100', p.note,
       (current_date - p.days_ago)::timestamptz + interval '10 hours'
FROM (
  SELECT '00000000-0000-0000-0000-000000000101'::uuid AS member, 12000 AS cents, 'etransfer' AS method, m*30 + 2 AS days_ago, NULL::text AS note
  FROM generate_series(0,3) m
  UNION ALL
  SELECT '00000000-0000-0000-0000-000000000102', 12000, 'cash', m*30 + 6, NULL FROM generate_series(0,3) m
  UNION ALL
  SELECT '00000000-0000-0000-0000-000000000103', 12000, 'etransfer', m*30 + 9, NULL FROM generate_series(1,3) m
  UNION ALL
  SELECT '00000000-0000-0000-0000-000000000105', 15000, 'cash', 14, '10-class punch card'
  UNION ALL
  SELECT '00000000-0000-0000-0000-000000000105', 2000, 'cash', 95, 'drop-in before joining'
) p;

-- ---- leads kanban (every stage + a live trial + $ values) ----
INSERT INTO leads (id, gym_id, first_name, last_name, email, phone, source, status,
                   trial_start, trial_end, follow_up_date, estimated_value_cents, notes, created_at) VALUES
('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000001','Jess','Morin','jess@example.com','514-555-0201','instagram','new',NULL,NULL,current_date + 1,12000,'DM''d about women''s classes',now() - interval '1 day'),
('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000001','Omar','Diallo',NULL,'514-555-0202','walk_in','contacted',NULL,NULL,current_date + 2,12000,'Came by Saturday, wants evening classes',now() - interval '4 days'),
('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000001','Priya','Sharma','priya@example.com',NULL,'referral','trial_scheduled',NULL,NULL,current_date + 3,12000,'Friend of Leila — trial booked for Fundamentals',now() - interval '6 days'),
('00000000-0000-0000-0000-000000000404','00000000-0000-0000-0000-000000000001','Max','Roy','max@example.com','514-555-0204','tiktok','trialing',current_date - 4,current_date + 2,current_date + 2,12000,'2 of 3 trial classes used',now() - interval '12 days'),
('00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000001','Chloé','Dubé','chloe@example.com',NULL,'fight_event','converted',NULL,NULL,NULL,12000,'Signed up after Golden Gloves night',now() - interval '30 days'),
('00000000-0000-0000-0000-000000000406','00000000-0000-0000-0000-000000000001','Sam','Kim',NULL,'514-555-0206','website','lost',NULL,NULL,NULL,NULL,'Moved to Laval',now() - interval '40 days');

-- ---- announcements + a few reads/reactions so the counts aren't zero ----
INSERT INTO announcements (id, gym_id, author_id, title, body, type, pinned, published_at) VALUES
('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000100',
 'Marco fights Aug 15! 🥊','Come support Marco at the Montreal Golden Gloves. Tickets at the front desk.','fight',true,now() - interval '2 days'),
('00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000100',
 'Holiday hours next Monday','Open 9:00–13:00 only. Regular schedule resumes Tuesday.','closure',false,now() - interval '4 days');

INSERT INTO announcement_reads (announcement_id, gym_member_id)
SELECT '00000000-0000-0000-0000-000000000501'::uuid, m FROM unnest(ARRAY[
  '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000105']::uuid[]) m
UNION ALL
SELECT '00000000-0000-0000-0000-000000000502'::uuid, m FROM unnest(ARRAY[
  '00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000103']::uuid[]) m;

INSERT INTO announcement_reactions (announcement_id, gym_member_id, emoji) VALUES
('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000101','👊'),
('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000102','👊'),
('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000105','👊');

-- ---- messages (CRM /messages has a thread going) ----
INSERT INTO messages (gym_id, sender_member_id, recipient_member_id, body, is_broadcast, created_at) VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000106',NULL,
 'Reminder: no sparring class this Friday — coach away.',true, now() - interval '2 days'),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101',NULL,
 'Hey, can I freeze my membership for July? Traveling.',false, now() - interval '1 day');

-- ---- coach note + tasks (Fighter Card tabs have content) ----
INSERT INTO coach_notes (gym_id, member_id, author_id, body, visibility) VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101',
 '00000000-0000-0000-0000-000000000106','Southpaw. Working on counter jab — big progress since May.','coaches');

INSERT INTO tasks (gym_id, title, body, due_at, status, created_by, target_member_id) VALUES
('00000000-0000-0000-0000-000000000001','Call Dave about overdue payment','2 months unpaid — offer a catch-up plan.',
 now() + interval '1 day','todo','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000103'),
('00000000-0000-0000-0000-000000000001','Print new QR poster for front desk',NULL,
 now() + interval '3 days','doing','00000000-0000-0000-0000-000000000100',NULL);
