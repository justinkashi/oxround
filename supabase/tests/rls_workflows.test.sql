-- OxRound — RLS workflow tests (pgTAP)
--
-- Purpose: replicate real user actions against the real security model and assert
-- the backend ALLOWS staff/owner actions and DENIES members. This is exactly the
-- class of bug that kept surfacing in the UI one at a time (missing table grants,
-- wrong RLS policy) — now caught automatically before anything ships.
--
-- Run:   supabase test db
--        (installs pgTAP and runs every *.sql in this folder inside a rolled-back
--         transaction, so nothing here touches real data.)
--
-- Self-contained: builds a throwaway gym + members as fixtures; no real accounts.
-- How it fakes a logged-in user: SET ROLE authenticated + SET request.jwt.claims,
-- which is what PostgREST does per request — so auth_gym_id()/is_staff()/is_owner()
-- and every RLS policy evaluate exactly as they do in production.

begin;
select plan(16);

-- ---------- fixtures (run as the test superuser, bypassing RLS) ----------
insert into gyms (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'RLS Test Gym', 'rls-test-gym');

insert into gym_members (id, gym_id, first_name, roles, status) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Owner',  array['owner']::text[],  'active'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Member', array['member']::text[], 'active');

insert into classes (id, gym_id, name, start_time)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Boxing 101', '18:00');

insert into class_sessions (id, gym_id, class_id, session_date, start_time, duration_mins)
values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', current_date, '18:00', 60);

-- ================= OWNER can run every core workflow =================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","gym_id":"11111111-1111-1111-1111-111111111111","roles":["owner"]}';

select lives_ok($$insert into gym_members(gym_id, roles, first_name) values ('11111111-1111-1111-1111-111111111111', array['member']::text[], 'New Member')$$, 'owner can add a member');
select lives_ok($$insert into memberships(gym_id, gym_member_id, status, payment_status, start_date) values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','active','pending',current_date)$$, 'owner can create a membership');
select lives_ok($$update gym_members set phone='514-555-0000' where id='33333333-3333-3333-3333-333333333333'$$, 'owner can edit a member');
select lives_ok($$insert into membership_plans(gym_id, name) values ('11111111-1111-1111-1111-111111111111','Monthly')$$, 'owner can create a plan');
select lives_ok($$insert into classes(gym_id, name, start_time) values ('11111111-1111-1111-1111-111111111111','Sparring','19:00')$$, 'owner can create a class');
select lives_ok($$insert into class_bookings(gym_id, session_id, gym_member_id, status) values ('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','booked')$$, 'owner can book a member into a session');
select lives_ok($$insert into check_ins(gym_id, gym_member_id, method) values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','manual_staff')$$, 'owner can record a check-in');
select lives_ok($$insert into payments(gym_id, gym_member_id, amount_cents, method) values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',5000,'cash')$$, 'owner can record a payment');
select lives_ok($$insert into leads(gym_id, first_name) values ('11111111-1111-1111-1111-111111111111','Walk-in')$$, 'owner can add a lead');
select lives_ok($$insert into announcements(gym_id, author_id, title) values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Closed Monday')$$, 'owner can post an announcement');

reset role;

-- ================= MEMBER is denied every staff action =================
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","gym_id":"11111111-1111-1111-1111-111111111111","roles":["member"]}';

select throws_ok($$insert into gym_members(gym_id, roles, first_name) values ('11111111-1111-1111-1111-111111111111', array['member']::text[], 'Hacker')$$, '42501', null, 'member CANNOT add members');
select throws_ok($$insert into payments(gym_id, gym_member_id, amount_cents, method) values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',1,'cash')$$, '42501', null, 'member CANNOT record payments');
select throws_ok($$insert into announcements(gym_id, author_id, title) values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','x')$$, '42501', null, 'member CANNOT post announcements');
select throws_ok($$insert into classes(gym_id, name, start_time) values ('11111111-1111-1111-1111-111111111111','x','18:00')$$, '42501', null, 'member CANNOT create classes');

select is((select count(*)::int from gym_members), 0, 'member sees 0 roster rows (RLS hides everyone else)');
select is((select count(*)::int from payments), 0, 'member sees 0 payment rows');

reset role;

select * from finish();
rollback;
