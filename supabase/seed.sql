-- Demo seed: G1 Boxing with realistic data for the first-customer demo.
-- Run after migrations: psql ... -f seed.sql  (or supabase db reset picks it up)

INSERT INTO gyms (id, name, slug, timezone, address, phone)
VALUES ('00000000-0000-0000-0000-000000000001', 'G1 Boxing', 'g1boxing',
        'America/Toronto', 'Vaudreuil-Dorion, QC', '450-000-0000');

-- Membership plans (kinds from logs.md data-setup list)
INSERT INTO membership_plans (gym_id, name, kind, price_cents, billing_period) VALUES
('00000000-0000-0000-0000-000000000001', 'Unlimited Monthly', 'recurring', 12900, 'monthly'),
('00000000-0000-0000-0000-000000000001', 'Annual',            'recurring', 129000, 'annual'),
('00000000-0000-0000-0000-000000000001', 'Drop-in',           'drop_in',   2000, NULL),
('00000000-0000-0000-0000-000000000001', '10-Class Punch Card','punch_card', 15000, NULL),
('00000000-0000-0000-0000-000000000001', 'Free Trial Week',   'trial',     0, NULL);

-- Members (check_in_token_hash = sha256 of 'demo-token-N' — regenerate for real use)
INSERT INTO gym_members (id, gym_id, first_name, last_name, email, roles, status, joined_at, check_in_token_hash) VALUES
('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','Marco','Silva','marco@example.com','{member}','active','2025-09-01', encode(digest('demo-token-1','sha256'),'hex')),
('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001','Leila','Tremblay','leila@example.com','{member}','active','2025-11-15', encode(digest('demo-token-2','sha256'),'hex')),
('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000001','Dave','Nguyen','dave@example.com','{member}','active','2026-01-10', encode(digest('demo-token-3','sha256'),'hex')),
('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000001','Sophie','Gagnon','sophie@example.com','{coach,member}','active','2024-06-01', encode(digest('demo-token-4','sha256'),'hex')),
('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000001','Karim','Haddad','karim@example.com','{member}','active','2026-03-20', encode(digest('demo-token-5','sha256'),'hex'));

INSERT INTO memberships (gym_id, gym_member_id, plan_id, status, payment_status, payment_method, start_date, next_billing_date)
SELECT '00000000-0000-0000-0000-000000000001', gm.id, mp.id, 'active',
       CASE gm.first_name WHEN 'Dave' THEN 'overdue' WHEN 'Karim' THEN 'pending' ELSE 'paid' END,
       'etransfer', gm.joined_at, CURRENT_DATE + 14
FROM gym_members gm
JOIN membership_plans mp ON mp.gym_id = gm.gym_id AND mp.name = 'Unlimited Monthly'
WHERE gm.gym_id = '00000000-0000-0000-0000-000000000001' AND 'member' = ANY(gm.roles);

-- Classes
INSERT INTO classes (gym_id, name, coach_id, day_of_week, start_time, duration_mins, capacity, color) VALUES
('00000000-0000-0000-0000-000000000001','Morning Boxing','00000000-0000-0000-0000-000000000104','{1,3,5}','07:00',60,16,'#e11d48'),
('00000000-0000-0000-0000-000000000001','Youth Program', '00000000-0000-0000-0000-000000000104','{2,4}','17:00',45,12,'#2563eb'),
('00000000-0000-0000-0000-000000000001','Sparring',      '00000000-0000-0000-0000-000000000104','{6}','10:00',90,10,'#7c3aed');

-- Check-in history (attendance trend data for the "user-loss numbers" demo)
INSERT INTO check_ins (gym_id, gym_member_id, method, checked_in_at)
SELECT '00000000-0000-0000-0000-000000000001', gm.id, 'manual_import',
       now() - (d || ' days')::interval - (floor(random()*8) || ' hours')::interval
FROM gym_members gm,
     generate_series(1, 60) d
WHERE gm.gym_id = '00000000-0000-0000-0000-000000000001'
  AND 'member' = ANY(gm.roles)
  -- Marco trains 3x/wk, Leila 2x/wk, Dave dropped off (at-risk demo), Karim new
  AND (
    (gm.first_name = 'Marco'  AND d % 2 = 0) OR
    (gm.first_name = 'Leila'  AND d % 3 = 0) OR
    (gm.first_name = 'Dave'   AND d > 25 AND d % 2 = 0) OR
    (gm.first_name = 'Karim'  AND d < 12 AND d % 3 = 0)
  );

-- Announcements
INSERT INTO announcements (gym_id, author_id, title, body, type, pinned) VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000104','Gym closed July 1','Closed for Canada Day. Regular schedule resumes July 2.','closure',false),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000104','Marco fights Aug 15! 🥊','Come support Marco at the Montreal Golden Gloves. Tickets at the front desk.','fight',true);
