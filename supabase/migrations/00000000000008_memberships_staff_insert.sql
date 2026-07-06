-- 0008: intentionally a NO-OP.
--
-- The membership INSERT policy was already widened from owner-only to all staff
-- by migration 0006 (memberships_staff_insert = gym_id = auth_gym_id() AND is_staff()),
-- so no change is needed here. Kept as a numbered placeholder so the migration
-- history stays contiguous and re-running `supabase db push` is safe.

do $$ begin null; end $$;
