-- Fix: custom_access_token_hook was failing at login with
--   "function auth_roles() does not exist" / 500 running the hook.
-- Cause: the hook (running as supabase_auth_admin) queried gym_members, which
-- triggered gym_members' RLS policies; those policies call auth_roles()/is_staff(),
-- which don't resolve in the auth-admin execution context → token issuance 500s.
-- Fix: make the hook SECURITY DEFINER (runs as owner = postgres = table owner,
-- which bypasses RLS) with an empty search_path and fully-qualified refs.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb := COALESCE(event->'claims', '{}'::jsonb);
  gm RECORD;
BEGIN
  SELECT gym_id, roles INTO gm
  FROM public.gym_members
  WHERE user_id = (event->>'user_id')::uuid
    AND status <> 'archived'
  LIMIT 1;

  IF FOUND THEN
    claims := jsonb_set(claims, '{gym_id}', to_jsonb(gm.gym_id));
    claims := jsonb_set(claims, '{roles}', to_jsonb(gm.roles));
  ELSE
    claims := jsonb_set(claims, '{gym_id}', 'null'::jsonb);
    claims := jsonb_set(claims, '{roles}', '[]'::jsonb);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
