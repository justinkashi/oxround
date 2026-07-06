-- 0009: DB hardening — driven by Supabase advisors (2026-07-06 audit).
--
-- Fixes, in order:
--   A. function_search_path_mutable: pin search_path='' on all helper functions
--      (set_updated_at, auth_gym_id, auth_roles, is_staff, is_owner, is_kiosk).
--   B. anon_security_definer_function_executable: revoke auth_member_id() from
--      anon/PUBLIC. authenticated keeps EXECUTE — RLS policies depend on it.
--   C. rls_enabled_no_policy on cron_job_log: add explicit owner-read policy
--      (writes remain service-role only).
--   D. unindexed_foreign_keys: covering index on every FK column.
--   E. auth_rls_initplan + multiple_permissive_policies: recreate ALL policies
--      consolidated (one permissive policy per table/action), scoped
--      TO authenticated, with auth.*()/helper calls wrapped in scalar
--      subselects so Postgres evaluates them once per query, not per row.
--
-- Semantics are unchanged — verified by supabase/tests/rls_workflows.test.sql.

-- ============ A. pin search_path on helper functions ============

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.auth_gym_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = '' AS
$$ SELECT (auth.jwt()->>'gym_id')::uuid $$;

CREATE OR REPLACE FUNCTION public.auth_roles() RETURNS text[]
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(auth.jwt()->'roles')),
    ARRAY[]::text[]
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS bool
LANGUAGE sql STABLE SET search_path = '' AS
$$ SELECT public.auth_roles() && ARRAY['owner','manager','coach','receptionist'] $$;

CREATE OR REPLACE FUNCTION public.is_owner() RETURNS bool
LANGUAGE sql STABLE SET search_path = '' AS
$$ SELECT public.auth_roles() && ARRAY['owner'] $$;

CREATE OR REPLACE FUNCTION public.is_kiosk() RETURNS bool
LANGUAGE sql STABLE SET search_path = '' AS
$$ SELECT (auth.jwt()->>'kiosk')::bool IS TRUE $$;

-- ============ B. lock down auth_member_id ============

REVOKE EXECUTE ON FUNCTION public.auth_member_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_member_id() FROM anon;
GRANT  EXECUTE ON FUNCTION public.auth_member_id() TO authenticated;

-- ============ C. cron_job_log: explicit owner-read ============

CREATE POLICY cron_log_owner_select ON cron_job_log FOR SELECT
  TO authenticated USING ((SELECT public.is_owner()));

-- ============ D. FK covering indexes ============

CREATE INDEX IF NOT EXISTS idx_gym_members_user          ON gym_members(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_gym                 ON membership_plans(gym_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member        ON memberships(gym_member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_plan          ON memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_gym              ON payments(gym_id);
CREATE INDEX IF NOT EXISTS idx_payments_member           ON payments(gym_member_id);
CREATE INDEX IF NOT EXISTS idx_payments_membership       ON payments(membership_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by      ON payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_classes_gym               ON classes(gym_id);
CREATE INDEX IF NOT EXISTS idx_classes_coach             ON classes(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class            ON class_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_coach            ON class_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_bookings_gym              ON class_bookings(gym_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session          ON class_bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_member           ON class_bookings(gym_member_id);
CREATE INDEX IF NOT EXISTS idx_checkins_session          ON check_ins(session_id);
CREATE INDEX IF NOT EXISTS idx_leads_gym                 ON leads(gym_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned            ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_captured_by         ON leads(captured_by);
CREATE INDEX IF NOT EXISTS idx_leads_converted           ON leads(converted_member_id);
CREATE INDEX IF NOT EXISTS idx_lead_act_gym              ON lead_activities(gym_id);
CREATE INDEX IF NOT EXISTS idx_lead_act_lead             ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_act_actor            ON lead_activities(actor_id);
CREATE INDEX IF NOT EXISTS idx_ann_gym                   ON announcements(gym_id);
CREATE INDEX IF NOT EXISTS idx_ann_author                ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_ann_reads_announcement    ON announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_ann_reads_member          ON announcement_reads(gym_member_id);
CREATE INDEX IF NOT EXISTS idx_ann_react_announcement    ON announcement_reactions(announcement_id);
CREATE INDEX IF NOT EXISTS idx_ann_react_member          ON announcement_reactions(gym_member_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_gym           ON coach_notes(gym_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_member        ON coach_notes(member_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_author        ON coach_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user          ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_gym         ON notifications(gym_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient   ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender           ON messages(sender_member_id);

-- ============ E. consolidated RLS policies ============
-- One permissive policy per (table, action). TO authenticated everywhere:
-- anon has zero table grants (0007), so this only stops the planner from
-- evaluating policies for anon. Helper calls wrapped in (SELECT ...) so they
-- run once per statement (fixes auth_rls_initplan).

-- ---- gyms ----
DROP POLICY IF EXISTS gyms_select ON gyms;
DROP POLICY IF EXISTS gyms_update ON gyms;
CREATE POLICY gyms_select ON gyms FOR SELECT TO authenticated
  USING (id = (SELECT public.auth_gym_id()));
CREATE POLICY gyms_update ON gyms FOR UPDATE TO authenticated
  USING (id = (SELECT public.auth_gym_id()) AND (SELECT public.is_owner()));

-- ---- profiles ----
DROP POLICY IF EXISTS profiles_own_select ON profiles;
DROP POLICY IF EXISTS profiles_own_update ON profiles;
DROP POLICY IF EXISTS profiles_own_insert ON profiles;
CREATE POLICY profiles_own_select ON profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY profiles_own_update ON profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY profiles_own_insert ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- ---- gym_members ---- (staff-or-self select merged)
DROP POLICY IF EXISTS members_staff_select ON gym_members;
DROP POLICY IF EXISTS members_self_select ON gym_members;
DROP POLICY IF EXISTS members_owner_insert ON gym_members;
DROP POLICY IF EXISTS members_owner_update ON gym_members;
CREATE POLICY members_select ON gym_members FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((SELECT public.is_staff()) OR user_id = (SELECT auth.uid())));
CREATE POLICY members_staff_insert ON gym_members FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY members_owner_update ON gym_members FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_owner()));
-- no DELETE policy: hard delete impossible (D-03)

-- ---- membership_plans ----
DROP POLICY IF EXISTS plans_select ON membership_plans;
DROP POLICY IF EXISTS plans_owner_insert ON membership_plans;
DROP POLICY IF EXISTS plans_owner_update ON membership_plans;
CREATE POLICY plans_select ON membership_plans FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()));
CREATE POLICY plans_owner_insert ON membership_plans FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_owner()));
CREATE POLICY plans_owner_update ON membership_plans FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_owner()));

-- ---- memberships ---- (staff-or-self select merged; staff writes per 0006)
DROP POLICY IF EXISTS memberships_staff_select ON memberships;
DROP POLICY IF EXISTS memberships_self_select ON memberships;
DROP POLICY IF EXISTS memberships_staff_insert ON memberships;
DROP POLICY IF EXISTS memberships_staff_update ON memberships;
CREATE POLICY memberships_select ON memberships FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((SELECT public.is_staff()) OR gym_member_id IN
              (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid()))));
CREATE POLICY memberships_staff_insert ON memberships FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY memberships_staff_update ON memberships FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

-- ---- payments ----
DROP POLICY IF EXISTS payments_staff_select ON payments;
DROP POLICY IF EXISTS payments_staff_insert ON payments;
CREATE POLICY payments_staff_select ON payments FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY payments_staff_insert ON payments FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

-- ---- classes / class_sessions ----
DROP POLICY IF EXISTS classes_select ON classes;
DROP POLICY IF EXISTS classes_staff_insert ON classes;
DROP POLICY IF EXISTS classes_staff_update ON classes;
CREATE POLICY classes_select ON classes FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()));
CREATE POLICY classes_staff_insert ON classes FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY classes_staff_update ON classes FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

DROP POLICY IF EXISTS sessions_select ON class_sessions;
DROP POLICY IF EXISTS sessions_staff_insert ON class_sessions;
DROP POLICY IF EXISTS sessions_staff_update ON class_sessions;
CREATE POLICY sessions_select ON class_sessions FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()));
CREATE POLICY sessions_staff_insert ON class_sessions FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY sessions_staff_update ON class_sessions FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

-- ---- class_bookings ---- (staff-or-self merged for select AND insert)
DROP POLICY IF EXISTS bookings_staff_select ON class_bookings;
DROP POLICY IF EXISTS bookings_self_select ON class_bookings;
DROP POLICY IF EXISTS bookings_self_insert ON class_bookings;
DROP POLICY IF EXISTS bookings_staff_insert ON class_bookings;
DROP POLICY IF EXISTS bookings_self_update ON class_bookings;
CREATE POLICY bookings_select ON class_bookings FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((SELECT public.is_staff()) OR gym_member_id IN
              (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid()))));
CREATE POLICY bookings_insert ON class_bookings FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id())
              AND ((SELECT public.is_staff()) OR gym_member_id IN
                   (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid()))));
CREATE POLICY bookings_update ON class_bookings FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((SELECT public.is_staff()) OR gym_member_id IN
              (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid()))));

-- ---- check_ins ----
DROP POLICY IF EXISTS checkins_staff_select ON check_ins;
DROP POLICY IF EXISTS checkins_self_select ON check_ins;
DROP POLICY IF EXISTS checkins_kiosk_insert ON check_ins;
CREATE POLICY checkins_select ON check_ins FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((SELECT public.is_staff()) OR gym_member_id IN
              (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid()))));
CREATE POLICY checkins_insert ON check_ins FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id())
              AND ((SELECT public.is_kiosk()) OR (SELECT public.is_staff())));

-- ---- leads / lead_activities ----
DROP POLICY IF EXISTS leads_staff_select ON leads;
DROP POLICY IF EXISTS leads_staff_insert ON leads;
DROP POLICY IF EXISTS leads_staff_update ON leads;
CREATE POLICY leads_staff_select ON leads FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY leads_staff_insert ON leads FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY leads_staff_update ON leads FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

DROP POLICY IF EXISTS lead_act_staff_select ON lead_activities;
DROP POLICY IF EXISTS lead_act_staff_insert ON lead_activities;
CREATE POLICY lead_act_staff_select ON lead_activities FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY lead_act_staff_insert ON lead_activities FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

-- ---- announcements + reads/reactions ----
DROP POLICY IF EXISTS ann_select ON announcements;
DROP POLICY IF EXISTS ann_staff_insert ON announcements;
DROP POLICY IF EXISTS ann_staff_update ON announcements;
CREATE POLICY ann_select ON announcements FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()));
CREATE POLICY ann_staff_insert ON announcements FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY ann_staff_update ON announcements FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

DROP POLICY IF EXISTS ann_reads_select ON announcement_reads;
DROP POLICY IF EXISTS ann_reads_insert ON announcement_reads;
CREATE POLICY ann_reads_select ON announcement_reads FOR SELECT TO authenticated
  USING (announcement_id IN (SELECT id FROM announcements WHERE gym_id = (SELECT public.auth_gym_id())));
CREATE POLICY ann_reads_insert ON announcement_reads FOR INSERT TO authenticated
  WITH CHECK (gym_member_id IN (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS ann_react_select ON announcement_reactions;
DROP POLICY IF EXISTS ann_react_insert ON announcement_reactions;
CREATE POLICY ann_react_select ON announcement_reactions FOR SELECT TO authenticated
  USING (announcement_id IN (SELECT id FROM announcements WHERE gym_id = (SELECT public.auth_gym_id())));
CREATE POLICY ann_react_insert ON announcement_reactions FOR INSERT TO authenticated
  WITH CHECK (gym_member_id IN (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid())));

-- ---- coach_notes ---- (three select paths merged into one policy)
DROP POLICY IF EXISTS notes_staff_select ON coach_notes;
DROP POLICY IF EXISTS notes_member_select ON coach_notes;
DROP POLICY IF EXISTS notes_staff_insert ON coach_notes;
DROP POLICY IF EXISTS notes_author_update ON coach_notes;
CREATE POLICY notes_select ON coach_notes FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((visibility = 'owner_only' AND (SELECT public.is_owner()))
           OR (visibility <> 'owner_only' AND (SELECT public.is_staff()))
           OR (visibility = 'member_visible' AND member_id IN
               (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid())))));
CREATE POLICY notes_staff_insert ON coach_notes FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY notes_author_update ON coach_notes FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND author_id IN (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid())));

-- ---- notifications / push_tokens ----
DROP POLICY IF EXISTS notif_staff_select ON notifications;
DROP POLICY IF EXISTS notif_self_select ON notifications;
DROP POLICY IF EXISTS notif_staff_insert ON notifications;
CREATE POLICY notif_select ON notifications FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((SELECT public.is_staff()) OR recipient_id IN
              (SELECT id FROM gym_members WHERE user_id = (SELECT auth.uid()))));
CREATE POLICY notif_staff_insert ON notifications FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

DROP POLICY IF EXISTS tokens_own ON push_tokens;
DROP POLICY IF EXISTS tokens_own_insert ON push_tokens;
DROP POLICY IF EXISTS tokens_own_update ON push_tokens;
CREATE POLICY tokens_own ON push_tokens FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY tokens_own_insert ON push_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY tokens_own_update ON push_tokens FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---- messages ---- (staff + member select merged)
DROP POLICY IF EXISTS messages_staff_select ON messages;
DROP POLICY IF EXISTS messages_member_select ON messages;
DROP POLICY IF EXISTS messages_insert ON messages;
DROP POLICY IF EXISTS messages_update_read ON messages;
CREATE POLICY messages_select ON messages FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((SELECT public.is_staff())
           OR is_broadcast
           OR sender_member_id = (SELECT public.auth_member_id())
           OR recipient_member_id = (SELECT public.auth_member_id())));
CREATE POLICY messages_insert ON messages FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id())
              AND sender_member_id = (SELECT public.auth_member_id())
              AND (is_broadcast = false OR (SELECT public.is_staff())));
CREATE POLICY messages_update_read ON messages FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND (recipient_member_id = (SELECT public.auth_member_id()) OR (SELECT public.is_staff())));
