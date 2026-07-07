-- Auto-create a profiles row whenever an auth user is created.
-- Fixes: invited users had no profiles row, so gym_members.user_id (FK -> profiles)
-- could not be linked, dead-ending activation at /no-access.
-- Standard Supabase handle_new_user pattern: id-only insert, ON CONFLICT DO NOTHING,
-- so it is safe on existing users, re-runs, and cannot fail on NOT NULL columns.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
