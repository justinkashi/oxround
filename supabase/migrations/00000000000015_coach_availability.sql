-- Coach full-profile: weekly availability shown/edited on the Coaches screen.
-- Stored as a jsonb array of windows: [{ "day": 0-6 (0=Sun), "start": "17:00", "end": "21:00" }].
-- Lives on gym_members because coaches are gym_members with the "coach"/"manager" role.

ALTER TABLE gym_members
  ADD COLUMN IF NOT EXISTS availability jsonb;
