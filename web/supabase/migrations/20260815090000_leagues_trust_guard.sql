-- 2026-08 audit PR-2 review (HIGH): leagues carried trust columns
-- (recognition_tier, reputation_score, verified_*) protected only by a
-- client-side whitelist — leagues_admin_update RLS gates ROWS, not columns, and
-- unlike clubs/player_profiles there was NO guard trigger, so any league admin
-- could self-grant the OFFICIAL badge with a direct supabase call. Mirror the
-- clubs guard: SECURITY INVOKER (so current_user is the caller role; a DEFINER
-- trigger would run as postgres and never fire) pinning trust columns for
-- authenticated/anon; definer functions + service_role pass through.

CREATE OR REPLACE FUNCTION public.guard_leagues_trust_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.recognition_tier := 'UNVERIFIED';
      NEW.reputation_score := 0;
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
      NEW.verification_source := NULL;
    ELSE
      NEW.recognition_tier := OLD.recognition_tier;
      NEW.reputation_score := OLD.reputation_score;
      NEW.verified_at := OLD.verified_at;
      NEW.verified_by := OLD.verified_by;
      NEW.verification_source := OLD.verification_source;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_leagues_trust ON public.leagues;
CREATE TRIGGER trg_guard_leagues_trust
  BEFORE INSERT OR UPDATE ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.guard_leagues_trust_columns();

-- Companion (PR-2 review, low): /account "Your tournaments" used owner_id only,
-- missing non-owner co-hosts. Mirror list_my_admin_clubs with the same
-- authority source every manage surface uses (is_scope_admin).
CREATE OR REPLACE FUNCTION public.list_my_admin_leagues()
RETURNS TABLE (id uuid, name text, registration_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT l.id, l.name, l.registration_status
  FROM public.leagues l
  WHERE public.is_scope_admin(auth.uid(), 'league', l.id)
  ORDER BY l.created_at DESC
  LIMIT 50;
$$;

REVOKE EXECUTE ON FUNCTION public.list_my_admin_leagues() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_admin_leagues() TO authenticated;
