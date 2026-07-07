-- 0011: base table privileges for service_role.
--
-- Same root cause as 0007: tables were created without Supabase's standard
-- role grants. 0007 fixed `authenticated` but not `service_role`, so every
-- Edge Function using the service key (invite-member's gym_members lookup)
-- failed with "permission denied for table gym_members". service_role
-- bypasses RLS, but RLS bypass still requires table-level GRANTs.
-- Standard Supabase setup gives service_role ALL on public tables.
-- Applied to the live project 2026-07-06 via MCP.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
