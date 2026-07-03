-- Custom Access Token hook as a Postgres function (replaces the auth-hook Edge Function).
-- Why: runs in-database — no HTTP round-trip per login/refresh, no webhook secret to manage.
-- Injects gym_id + roles[] into the JWT from gym_members at token issue time (D-06).
-- Dashboard wiring: Authentication → Hooks → Customize Access Token (JWT) Claims
--   → Hook type: Postgres → schema: public → function: custom_access_token_hook.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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

-- Permissions required by Supabase Auth (per Supabase custom-access-token docs):
-- the auth server runs as supabase_auth_admin and must be able to execute the hook
-- and read gym_members; nobody else may call the hook.
-- Role guard: these roles are pre-created on real Supabase; create them if absent
-- so scripts/validate-migrations.mjs (PGlite) can run this migration too.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
GRANT SELECT ON TABLE public.gym_members TO supabase_auth_admin;

DROP POLICY IF EXISTS "auth_admin_read_for_token_hook" ON public.gym_members;
CREATE POLICY "auth_admin_read_for_token_hook"
  ON public.gym_members
  AS PERMISSIVE FOR SELECT
  TO supabase_auth_admin
  USING (true);
