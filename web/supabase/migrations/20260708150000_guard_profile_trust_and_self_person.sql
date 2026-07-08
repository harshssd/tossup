-- Phase D1/D3 hardening.
--
-- 1. Guard the recognition/trust columns on player_profiles against direct
--    client writes. pp_owner_update (PR #16) lets an owner update their own
--    profile row, but it has no column-level protection — so an authenticated
--    owner could self-set recognition_tier='OFFICIAL' or inflate
--    reputation_score, forging the platform's core recognition signal and gaming
--    /discover ranking. The new onboarding wizard's updateOwnedProfile widens
--    that exposure, so lock it at the source: a BEFORE INSERT/UPDATE trigger
--    that pins the trust columns for client (authenticated/anon) callers.
--    SECURITY DEFINER helpers (handle_new_user, merge_persons, recognition
--    engine) and service_role run as other roles, so current_user is not
--    'authenticated'/'anon' there and the trigger leaves their writes alone.
--    NOTE: this trigger is intentionally SECURITY INVOKER (the default) so
--    current_user reflects the DML caller's role.
--
-- 2. ensure_self_person(): resolve the caller's primary Person, creating +
--    linking one if missing, so the onboarding wizard always updates a real
--    primary profile (never orphans a second profile with users.primary_person_id
--    left null, which would break join-request approval and dedup downstream).

-- 1 — trust-column guard --------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_player_profile_trust_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Only constrain direct PostgREST client writes. Definer functions and
  -- service_role run as a different current_user and are trusted to set these.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.recognition_tier := 'COMMUNITY';
      NEW.reputation_score := 0;
      NEW.merged_into_id := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.recognition_tier := OLD.recognition_tier;
      NEW.reputation_score := OLD.reputation_score;
      NEW.merged_into_id := OLD.merged_into_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_player_profile_trust ON public.player_profiles;
CREATE TRIGGER trg_guard_player_profile_trust
  BEFORE INSERT OR UPDATE ON public.player_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_player_profile_trust_columns();

-- 2 — ensure_self_person --------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_self_person(p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_person uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Lock the users row so concurrent calls don't each create a profile. If the
  -- row is missing (handle_new_user should always have created it in the signup
  -- txn) the lock would protect nothing, so fail loudly rather than spawn orphan
  -- profiles that never get linked as primary_person_id.
  SELECT primary_person_id INTO v_person FROM public.users WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no user record for %', v_uid;
  END IF;
  IF v_person IS NOT NULL THEN
    RETURN v_person;
  END IF;

  INSERT INTO public.player_profiles (user_id, display_name)
  VALUES (v_uid, COALESCE(NULLIF(btrim(p_display_name), ''), 'Player'))
  RETURNING id INTO v_person;

  UPDATE public.users SET primary_person_id = v_person
  WHERE id = v_uid AND primary_person_id IS NULL;

  RETURN v_person;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_self_person(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_self_person(text) TO authenticated;
