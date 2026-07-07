-- G1 feedback: customer profile fields shown/editable from the Fighter Card.
-- `profiles.date_of_birth` already exists for signed-in users; this mirrors it
-- on `gym_members` because owners can create member records before app signup.

ALTER TABLE gym_members
  ADD COLUMN IF NOT EXISTS date_of_birth date;
