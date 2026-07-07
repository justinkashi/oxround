-- App-join status for members/coaches: not_invited -> invited -> active.
-- Separate axis from status (archival) and memberships.payment_status (money).

ALTER TABLE public.gym_members
  ADD COLUMN IF NOT EXISTS invite_status text NOT NULL DEFAULT 'not_invited'
  CHECK (invite_status IN ('not_invited','invited','active'));

-- Flip a member to 'active' the moment they activate their invite.
-- SECURITY DEFINER because a member cannot UPDATE their own gym_members row under RLS
-- (that policy is owner-only). Idempotent; only ever touches the caller's own row.
CREATE OR REPLACE FUNCTION public.mark_member_activated()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.gym_members
  SET invite_status = 'active'
  WHERE user_id = auth.uid() AND invite_status <> 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_member_activated() TO authenticated;

-- Backfill: anyone already linked to an auth account counts as active.
UPDATE public.gym_members SET invite_status = 'active' WHERE user_id IS NOT NULL;
