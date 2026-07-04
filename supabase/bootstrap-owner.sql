-- OxRound owner bootstrap (DEPLOY.md 5.5) — prod-safe replacement for seed.sql.
-- Run ONCE in the Supabase SQL editor AFTER the owner's auth user exists
-- (Authentication → Users → Add user → Create new user, auto-confirm ON).
--
-- ⚠️ Replace OWNER_EMAIL_HERE (2 places) and the names before running.
-- Safe to re-run: it aborts if the email has no auth user, and won't duplicate
-- the gym or membership thanks to the unique slug / (gym_id, user_id) constraints.

WITH me AS (
  SELECT id, email FROM auth.users WHERE email = 'OWNER_EMAIL_HERE'
),
gym AS (
  INSERT INTO gyms (name, slug)
  VALUES ('G1 Boxing', 'g1-boxing')
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
prof AS (
  INSERT INTO profiles (id, first_name, last_name)
  SELECT id, 'FIRST_NAME_HERE', 'LAST_NAME_HERE' FROM me
  ON CONFLICT (id) DO NOTHING
)
INSERT INTO gym_members (gym_id, user_id, first_name, last_name, email, roles, status, joined_at)
SELECT gym.id, me.id, 'FIRST_NAME_HERE', 'LAST_NAME_HERE', me.email, ARRAY['owner'], 'active', CURRENT_DATE
FROM gym, me
ON CONFLICT (gym_id, user_id) DO NOTHING;

-- Verify (should return 1 row with roles = {owner}):
SELECT gm.first_name, gm.roles, g.name AS gym
FROM gym_members gm JOIN gyms g ON g.id = gm.gym_id
WHERE gm.email = 'OWNER_EMAIL_HERE';
