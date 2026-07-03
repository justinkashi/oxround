-- OxRound RLS policies
-- Pattern: gym_id = (auth.jwt()->>'gym_id')::uuid on every tenant table.
-- D-03: NO "FOR ALL" policies anywhere. DELETE is never granted — archive via UPDATE status='archived'.
-- D-01: kiosk role gets INSERT-only on check_ins via 'kiosk' claim in a gym-scoped JWT.

-- Helper predicates
CREATE OR REPLACE FUNCTION auth_gym_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'gym_id')::uuid $$;

CREATE OR REPLACE FUNCTION auth_roles() RETURNS text[]
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(auth.jwt()->'roles')),
    ARRAY[]::text[]
  )
$$;

CREATE OR REPLACE FUNCTION is_staff() RETURNS bool
LANGUAGE sql STABLE AS $$ SELECT auth_roles() && ARRAY['owner','manager','coach','receptionist'] $$;

CREATE OR REPLACE FUNCTION is_owner() RETURNS bool
LANGUAGE sql STABLE AS $$ SELECT auth_roles() && ARRAY['owner'] $$;

CREATE OR REPLACE FUNCTION is_kiosk() RETURNS bool
LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'kiosk')::bool IS TRUE $$;

-- ============ gyms ============
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
CREATE POLICY gyms_select ON gyms FOR SELECT USING (id = auth_gym_id());
CREATE POLICY gyms_update ON gyms FOR UPDATE USING (id = auth_gym_id() AND is_owner());

-- ============ profiles ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_own_select ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_own_update ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY profiles_own_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- ============ gym_members ============
ALTER TABLE gym_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_staff_select ON gym_members FOR SELECT
  USING (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY members_self_select ON gym_members FOR SELECT
  USING (gym_id = auth_gym_id() AND user_id = auth.uid());
CREATE POLICY members_owner_insert ON gym_members FOR INSERT
  WITH CHECK (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY members_owner_update ON gym_members FOR UPDATE
  USING (gym_id = auth_gym_id() AND is_owner());
-- no DELETE policy: hard delete impossible (D-03)

-- ============ membership_plans / memberships / payments ============
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_select ON membership_plans FOR SELECT USING (gym_id = auth_gym_id());
CREATE POLICY plans_owner_insert ON membership_plans FOR INSERT WITH CHECK (gym_id = auth_gym_id() AND is_owner());
CREATE POLICY plans_owner_update ON membership_plans FOR UPDATE USING (gym_id = auth_gym_id() AND is_owner());

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_staff_select ON memberships FOR SELECT
  USING (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY memberships_self_select ON memberships FOR SELECT
  USING (gym_id = auth_gym_id() AND gym_member_id IN
    (SELECT id FROM gym_members WHERE user_id = auth.uid()));
CREATE POLICY memberships_owner_insert ON memberships FOR INSERT
  WITH CHECK (gym_id = auth_gym_id() AND is_owner());
CREATE POLICY memberships_owner_update ON memberships FOR UPDATE
  USING (gym_id = auth_gym_id() AND is_owner());

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_staff_select ON payments FOR SELECT USING (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY payments_staff_insert ON payments FOR INSERT WITH CHECK (gym_id = auth_gym_id() AND is_staff());

-- ============ classes / sessions / bookings ============
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY classes_select ON classes FOR SELECT USING (gym_id = auth_gym_id());
CREATE POLICY classes_staff_insert ON classes FOR INSERT WITH CHECK (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY classes_staff_update ON classes FOR UPDATE USING (gym_id = auth_gym_id() AND is_staff());

ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_select ON class_sessions FOR SELECT USING (gym_id = auth_gym_id());
CREATE POLICY sessions_staff_insert ON class_sessions FOR INSERT WITH CHECK (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY sessions_staff_update ON class_sessions FOR UPDATE USING (gym_id = auth_gym_id() AND is_staff());

ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_staff_select ON class_bookings FOR SELECT
  USING (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY bookings_self_select ON class_bookings FOR SELECT
  USING (gym_id = auth_gym_id() AND gym_member_id IN
    (SELECT id FROM gym_members WHERE user_id = auth.uid()));
CREATE POLICY bookings_self_insert ON class_bookings FOR INSERT
  WITH CHECK (gym_id = auth_gym_id() AND gym_member_id IN
    (SELECT id FROM gym_members WHERE user_id = auth.uid()));
CREATE POLICY bookings_self_update ON class_bookings FOR UPDATE
  USING (gym_id = auth_gym_id() AND (is_staff() OR gym_member_id IN
    (SELECT id FROM gym_members WHERE user_id = auth.uid())));

-- ============ check_ins ============
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkins_staff_select ON check_ins FOR SELECT
  USING (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY checkins_self_select ON check_ins FOR SELECT
  USING (gym_id = auth_gym_id() AND gym_member_id IN
    (SELECT id FROM gym_members WHERE user_id = auth.uid()));
-- D-01: kiosk JWT (gym-scoped, kiosk:true claim) may ONLY insert check_ins for its gym
CREATE POLICY checkins_kiosk_insert ON check_ins FOR INSERT
  WITH CHECK (gym_id = auth_gym_id() AND (is_kiosk() OR is_staff()));

-- ============ leads ============
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_staff_select ON leads FOR SELECT USING (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY leads_staff_insert ON leads FOR INSERT WITH CHECK (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY leads_staff_update ON leads FOR UPDATE USING (gym_id = auth_gym_id() AND is_staff());

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_act_staff_select ON lead_activities FOR SELECT USING (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY lead_act_staff_insert ON lead_activities FOR INSERT WITH CHECK (gym_id = auth_gym_id() AND is_staff());

-- ============ announcements ============
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY ann_select ON announcements FOR SELECT USING (gym_id = auth_gym_id());
CREATE POLICY ann_staff_insert ON announcements FOR INSERT WITH CHECK (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY ann_staff_update ON announcements FOR UPDATE USING (gym_id = auth_gym_id() AND is_staff());

ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY ann_reads_select ON announcement_reads FOR SELECT
  USING (announcement_id IN (SELECT id FROM announcements WHERE gym_id = auth_gym_id()));
CREATE POLICY ann_reads_insert ON announcement_reads FOR INSERT
  WITH CHECK (gym_member_id IN (SELECT id FROM gym_members WHERE user_id = auth.uid()));

ALTER TABLE announcement_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ann_react_select ON announcement_reactions FOR SELECT
  USING (announcement_id IN (SELECT id FROM announcements WHERE gym_id = auth_gym_id()));
CREATE POLICY ann_react_insert ON announcement_reactions FOR INSERT
  WITH CHECK (gym_member_id IN (SELECT id FROM gym_members WHERE user_id = auth.uid()));

-- ============ coach_notes ============
ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_staff_select ON coach_notes FOR SELECT
  USING (gym_id = auth_gym_id() AND
    ((visibility = 'owner_only' AND is_owner()) OR (visibility <> 'owner_only' AND is_staff())));
CREATE POLICY notes_member_select ON coach_notes FOR SELECT
  USING (gym_id = auth_gym_id() AND visibility = 'member_visible' AND member_id IN
    (SELECT id FROM gym_members WHERE user_id = auth.uid()));
CREATE POLICY notes_staff_insert ON coach_notes FOR INSERT WITH CHECK (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY notes_author_update ON coach_notes FOR UPDATE
  USING (gym_id = auth_gym_id() AND author_id IN (SELECT id FROM gym_members WHERE user_id = auth.uid()));

-- ============ notifications / push_tokens ============
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_staff_select ON notifications FOR SELECT USING (gym_id = auth_gym_id() AND is_staff());
CREATE POLICY notif_self_select ON notifications FOR SELECT
  USING (gym_id = auth_gym_id() AND recipient_id IN
    (SELECT id FROM gym_members WHERE user_id = auth.uid()));
CREATE POLICY notif_staff_insert ON notifications FOR INSERT WITH CHECK (gym_id = auth_gym_id() AND is_staff());

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tokens_own ON push_tokens FOR SELECT USING (user_id = auth.uid());
CREATE POLICY tokens_own_insert ON push_tokens FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY tokens_own_update ON push_tokens FOR UPDATE USING (user_id = auth.uid());

-- ============ cron_job_log: server-only (service role bypasses RLS) ============
ALTER TABLE cron_job_log ENABLE ROW LEVEL SECURITY;
