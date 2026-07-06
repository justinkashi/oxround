-- 0010: Twenty-transfer schema — activity timeline, tasks, attachments,
-- full-text search, kanban ordering, idempotency keys.
--
-- Patterns borrowed from Twenty CRM's standard objects (see docs/DECISIONS.md):
--   * timeline_events ≈ Twenty timelineActivity: one row per thing that happened
--     to a record; powers the Fighter Card activity feed. Auto-populated by
--     triggers on check_ins / payments / gym_members / memberships + backfilled.
--   * tasks ≈ Twenty Task (title, due_at, status, assignee) targeted at a
--     member or lead. Notes tab reuses the existing coach_notes table — no new
--     notes table (avoids duplication).
--   * attachments ≈ Twenty Attachment: file metadata + Storage path; waivers
--     and documents on a member/lead.
--   * search_vector ≈ Twenty searchVector: generated tsvector on members/leads.
--   * leads.position / estimated_value_cents: kanban drag-ordering + column $.
--   * client_key: frontend-generated idempotency key; UNIQUE means a retried
--     insert (double-click, network retry) errors instead of duplicating.
--
-- Soft-delete convention: NEW tables use deleted_at (Twenty style); existing
-- tables keep status='archived' / is_active (D-03) — both recoverable.

-- ============ timeline_events ============

CREATE TABLE timeline_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id           uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  happens_at       timestamptz NOT NULL DEFAULT now(),
  event_type       text NOT NULL CHECK (event_type IN
                     ('check_in','payment','membership_change','member_created',
                      'status_change','note_added','task_done','message','custom')),
  title            text,
  properties       jsonb,
  actor_member_id  uuid REFERENCES gym_members(id),
  target_member_id uuid REFERENCES gym_members(id) ON DELETE CASCADE,
  target_lead_id   uuid REFERENCES leads(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_timeline_member ON timeline_events(target_member_id, happens_at DESC);
CREATE INDEX idx_timeline_lead   ON timeline_events(target_lead_id, happens_at DESC);
CREATE INDEX idx_timeline_gym    ON timeline_events(gym_id, happens_at DESC);
CREATE INDEX idx_timeline_actor  ON timeline_events(actor_member_id);

ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY timeline_select ON timeline_events FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((SELECT public.is_staff()) OR target_member_id = (SELECT public.auth_member_id())));
CREATE POLICY timeline_staff_insert ON timeline_events FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
-- no UPDATE/DELETE policies: the timeline is append-only.

-- ============ tasks ============

CREATE TABLE tasks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id             uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  title              text NOT NULL,
  body               text,
  due_at             timestamptz,
  status             text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  position           double precision NOT NULL DEFAULT 0,
  assignee_member_id uuid REFERENCES gym_members(id),
  created_by         uuid REFERENCES gym_members(id),
  target_member_id   uuid REFERENCES gym_members(id) ON DELETE CASCADE,
  target_lead_id     uuid REFERENCES leads(id) ON DELETE CASCADE,
  client_key         uuid UNIQUE,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_gym      ON tasks(gym_id, status, due_at);
CREATE INDEX idx_tasks_member   ON tasks(target_member_id);
CREATE INDEX idx_tasks_lead     ON tasks(target_lead_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_member_id);
CREATE INDEX idx_tasks_creator  ON tasks(created_by);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_staff_select ON tasks FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY tasks_staff_insert ON tasks FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY tasks_staff_update ON tasks FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

-- ============ attachments ============

CREATE TABLE attachments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id           uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name             text NOT NULL,
  storage_path     text NOT NULL,          -- path inside the 'attachments' bucket
  mime_type        text,
  size_bytes       bigint,
  category         text NOT NULL DEFAULT 'document'
                   CHECK (category IN ('waiver','document','image','other')),
  author_member_id uuid REFERENCES gym_members(id),
  target_member_id uuid REFERENCES gym_members(id) ON DELETE CASCADE,
  target_lead_id   uuid REFERENCES leads(id) ON DELETE CASCADE,
  client_key       uuid UNIQUE,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_member ON attachments(target_member_id);
CREATE INDEX idx_attachments_lead   ON attachments(target_lead_id);
CREATE INDEX idx_attachments_gym    ON attachments(gym_id);
CREATE INDEX idx_attachments_author ON attachments(author_member_id);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
-- Staff see all; a member sees files attached to their own record (e.g. waiver).
CREATE POLICY attachments_select ON attachments FOR SELECT TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id())
         AND ((SELECT public.is_staff()) OR target_member_id = (SELECT public.auth_member_id())));
CREATE POLICY attachments_staff_insert ON attachments FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));
CREATE POLICY attachments_staff_update ON attachments FOR UPDATE TO authenticated
  USING (gym_id = (SELECT public.auth_gym_id()) AND (SELECT public.is_staff()));

-- ============ full-text search (Twenty searchVector pattern) ============

ALTER TABLE gym_members ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple',
    coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
    coalesce(email,'') || ' ' || coalesce(phone,''))) STORED;
CREATE INDEX idx_gym_members_search ON gym_members USING gin(search_vector);

ALTER TABLE leads ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple',
    coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
    coalesce(email,'') || ' ' || coalesce(phone,''))) STORED;
CREATE INDEX idx_leads_search ON leads USING gin(search_vector);

-- ============ kanban ordering + column value ============

ALTER TABLE leads ADD COLUMN position double precision NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN estimated_value_cents int;

-- ============ idempotency keys on hot creation paths ============

ALTER TABLE gym_members ADD COLUMN client_key uuid UNIQUE;
ALTER TABLE payments    ADD COLUMN client_key uuid UNIQUE;
ALTER TABLE leads       ADD COLUMN client_key uuid UNIQUE;
ALTER TABLE messages    ADD COLUMN client_key uuid UNIQUE;
ALTER TABLE memberships ADD COLUMN client_key uuid UNIQUE;

-- created_by audit on members (who at the desk added this person)
ALTER TABLE gym_members ADD COLUMN created_by uuid REFERENCES gym_members(id);
CREATE INDEX idx_gym_members_created_by ON gym_members(created_by);

-- ============ auto-log triggers (SECURITY DEFINER: kiosk/member inserts
-- must still be able to write the timeline row) ============

CREATE OR REPLACE FUNCTION public.log_check_in() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.timeline_events (gym_id, happens_at, event_type, title, properties, target_member_id)
  VALUES (NEW.gym_id, NEW.checked_in_at, 'check_in', 'Checked in',
          jsonb_build_object('method', NEW.method, 'session_id', NEW.session_id),
          NEW.gym_member_id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_check_in() FROM PUBLIC, anon;
CREATE TRIGGER trg_log_check_in AFTER INSERT ON check_ins
  FOR EACH ROW EXECUTE FUNCTION public.log_check_in();

CREATE OR REPLACE FUNCTION public.log_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.timeline_events (gym_id, happens_at, event_type, title, properties, actor_member_id, target_member_id)
  VALUES (NEW.gym_id, NEW.created_at, 'payment', 'Payment received',
          jsonb_build_object('amount_cents', NEW.amount_cents, 'method', NEW.method, 'paid_at', NEW.paid_at),
          NEW.recorded_by, NEW.gym_member_id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_payment() FROM PUBLIC, anon;
CREATE TRIGGER trg_log_payment AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION public.log_payment();

CREATE OR REPLACE FUNCTION public.log_member_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.timeline_events (gym_id, happens_at, event_type, title, actor_member_id, target_member_id)
  VALUES (NEW.gym_id, NEW.created_at, 'member_created', 'Joined the gym', NEW.created_by, NEW.id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_member_created() FROM PUBLIC, anon;
CREATE TRIGGER trg_log_member_created AFTER INSERT ON gym_members
  FOR EACH ROW EXECUTE FUNCTION public.log_member_created();

CREATE OR REPLACE FUNCTION public.log_member_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.timeline_events (gym_id, event_type, title, properties, target_member_id)
    VALUES (NEW.gym_id, 'status_change',
            'Status: ' || OLD.status || ' → ' || NEW.status,
            jsonb_build_object('from', OLD.status, 'to', NEW.status), NEW.id);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_member_status_change() FROM PUBLIC, anon;
CREATE TRIGGER trg_log_member_status AFTER UPDATE ON gym_members
  FOR EACH ROW EXECUTE FUNCTION public.log_member_status_change();

CREATE OR REPLACE FUNCTION public.log_membership_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.timeline_events (gym_id, event_type, title, properties, target_member_id)
    VALUES (NEW.gym_id, 'membership_change',
            'Membership payment status: ' || COALESCE(OLD.payment_status,'—') || ' → ' || COALESCE(NEW.payment_status,'—'),
            jsonb_build_object('from', OLD.payment_status, 'to', NEW.payment_status, 'membership_id', NEW.id),
            NEW.gym_member_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_membership_change() FROM PUBLIC, anon;
CREATE TRIGGER trg_log_membership_change AFTER UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION public.log_membership_change();

-- ============ backfill history so the timeline isn't empty on day one ============

INSERT INTO timeline_events (gym_id, happens_at, event_type, title, properties, target_member_id)
SELECT gym_id, checked_in_at, 'check_in', 'Checked in',
       jsonb_build_object('method', method, 'session_id', session_id), gym_member_id
FROM check_ins;

INSERT INTO timeline_events (gym_id, happens_at, event_type, title, properties, actor_member_id, target_member_id)
SELECT gym_id, created_at, 'payment', 'Payment received',
       jsonb_build_object('amount_cents', amount_cents, 'method', method, 'paid_at', paid_at),
       recorded_by, gym_member_id
FROM payments;

INSERT INTO timeline_events (gym_id, happens_at, event_type, title, target_member_id)
SELECT gym_id, created_at, 'member_created', 'Joined the gym', id
FROM gym_members;

-- ============ storage bucket for attachments (private) ============

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Staff of a gym read/write only under their own gym's folder: <gym_id>/...
CREATE POLICY attachments_bucket_staff_all ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'attachments'
         AND (storage.foldername(name))[1] = (SELECT public.auth_gym_id())::text
         AND (SELECT public.is_staff()))
  WITH CHECK (bucket_id = 'attachments'
              AND (storage.foldername(name))[1] = (SELECT public.auth_gym_id())::text
              AND (SELECT public.is_staff()));
