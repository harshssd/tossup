-- Phase 0 (identity model): auth keystone — provision a platform account + a
-- "self" Person on signup, so every authenticated user has exactly one canonical
-- Person to act/author/own as.
--
-- Player <-> User is many->one (a user owns many Persons; each Person <= 1 user).
-- The self-Person is the user's own identity; users.primary_person_id points at it
-- and is how "the current user's own Person" is resolved everywhere.
--
-- Idempotent + strictly additive: anon reads/writes are untouched. The function is
-- SECURITY DEFINER (bypasses RLS) with a locked search_path.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS primary_person_id UUID REFERENCES public.player_profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name   TEXT := COALESCE(
                     NEW.raw_user_meta_data->>'name',
                     NEW.raw_user_meta_data->>'full_name',
                     NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
                     'Player');
  v_person UUID;
BEGIN
  -- 1) mirror the auth user into public.users (idempotent)
  INSERT INTO public.users (id, email, name, image)
  VALUES (NEW.id, NEW.email, v_name, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  -- 2) create the self-Person exactly once, then link it
  SELECT primary_person_id INTO v_person FROM public.users WHERE id = NEW.id;
  IF v_person IS NULL THEN
    INSERT INTO public.player_profiles (display_name, user_id)
    VALUES (v_name, NEW.id)
    RETURNING id INTO v_person;
    UPDATE public.users SET primary_person_id = v_person WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
