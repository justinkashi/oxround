-- 0007: base table privileges for the authenticated role.
--
-- Root cause of "permission denied for table ..." on every logged-in write
-- (and the "empty" real CRM): the public tables were created by earlier
-- migrations WITHOUT Supabase's standard role grants, so the `authenticated`
-- role had no table-level SELECT/INSERT/UPDATE. RLS only decides WHICH rows a
-- role may touch — it still needs a base grant to touch the table at all.
-- With no grant, RLS policies could never take effect: reads returned nothing
-- and writes (e.g. Add member) failed with 42501 permission denied.
--
-- Fix: grant the table-level privileges the RLS policies are designed to sit on.
-- DELETE is intentionally NOT granted (D-03: no hard delete; archive via UPDATE).
-- service_role already bypasses RLS; anon stays read/write-less (app is auth-gated).

grant usage on schema public to authenticated, anon;

grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
