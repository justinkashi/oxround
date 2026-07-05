-- Messaging (Step 6F / D-23): two-way 1:1 staff↔member + staff broadcast to all members.
-- recipient_member_id NULL + is_broadcast => broadcast to every member of the gym.

-- Caller's own gym_members id (SECURITY DEFINER + empty search_path to avoid RLS recursion).
CREATE OR REPLACE FUNCTION public.auth_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.gym_members WHERE user_id = auth.uid() AND status <> 'archived' LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.auth_member_id() TO authenticated;

CREATE TABLE messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  sender_member_id    uuid NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
  recipient_member_id uuid REFERENCES gym_members(id) ON DELETE CASCADE,  -- NULL = broadcast
  body                text NOT NULL,
  is_broadcast        bool NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  read_at             timestamptz
);
CREATE INDEX idx_messages_gym ON messages(gym_id, created_at DESC);
CREATE INDEX idx_messages_recipient ON messages(recipient_member_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Staff see all messages in their gym.
CREATE POLICY messages_staff_select ON messages FOR SELECT
  USING (gym_id = auth_gym_id() AND is_staff());

-- Members see: broadcasts, and 1:1 messages where they're sender or recipient.
CREATE POLICY messages_member_select ON messages FOR SELECT
  USING (
    gym_id = auth_gym_id()
    AND (is_broadcast OR sender_member_id = auth_member_id() OR recipient_member_id = auth_member_id())
  );

-- Anyone in the gym can send as themselves. (Staff may broadcast; app restricts member UI to gym.)
CREATE POLICY messages_insert ON messages FOR INSERT
  WITH CHECK (
    gym_id = auth_gym_id()
    AND sender_member_id = auth_member_id()
    AND (is_broadcast = false OR is_staff())
  );

-- Recipient (or staff) can mark a message read.
CREATE POLICY messages_update_read ON messages FOR UPDATE
  USING (gym_id = auth_gym_id() AND (recipient_member_id = auth_member_id() OR is_staff()));
