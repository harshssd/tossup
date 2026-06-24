-- Phase 0 hardening (review finding): make self-Person provisioning best-effort
-- so a failure in player_profiles can NEVER abort the auth signup transaction
-- (which would surface to the user as an opaque "Database error saving new user"
-- and could leave a half-provisioned row). The public.users mirror stays
-- mandatory; the self-Person is created in a nested block that swallows errors —
-- a missing primary_person_id is tolerated by getPlatformUser() and can be
-- backfilled later.

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
  INSERT INTO public.users (id, email, name, image)
  VALUES (NEW.id, NEW.email, v_name, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    SELECT primary_person_id INTO v_person FROM public.users WHERE id = NEW.id;
    IF v_person IS NULL THEN
      INSERT INTO public.player_profiles (display_name, user_id)
      VALUES (v_name, NEW.id)
      RETURNING id INTO v_person;
      UPDATE public.users SET primary_person_id = v_person WHERE id = NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Self-Person provisioning is best-effort; never abort auth signup.
    NULL;
  END;

  RETURN NEW;
END $$;
