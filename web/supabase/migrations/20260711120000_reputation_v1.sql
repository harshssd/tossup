-- Phase D4 — reputation v1.
--
-- A transparent, activity-based reputation score for clubs and players that the
-- /discover ranking already consumes (recognition_tier first, then
-- reputation_score). recompute_reputation() is a full idempotent recompute run
-- nightly by pg_cron (see 20260711120100_schedule_reputation_cron.sql). The
-- per-signal breakdown is cached in reputation_signals (jsonb) for transparency.
--
-- Weights are deliberately simple and legible (v1): a weighted sum of a few
-- cheap counts. No decay/normalisation yet.

-- Symmetric transparency column (clubs already has reputation_signals).
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS reputation_signals jsonb;

-- ---------------------------------------------------------------------------
-- Extend the player_profiles trust guard (from 20260708150000) to also pin
-- reputation_signals — it is system-computed like reputation_score, so a client
-- must not be able to forge the breakdown either.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_player_profile_trust_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.recognition_tier := 'COMMUNITY';
      NEW.reputation_score := 0;
      NEW.reputation_signals := NULL;
      NEW.merged_into_id := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.recognition_tier := OLD.recognition_tier;
      NEW.reputation_score := OLD.reputation_score;
      NEW.reputation_signals := OLD.reputation_signals;
      NEW.merged_into_id := OLD.merged_into_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Clubs have the same trust columns AND an owner-editable write path
-- (createOwnedClub spreads Partial<Club> into the insert; club admins can
-- update). Guard them the same way so a club can't self-declare recognition,
-- inflate reputation, or fake verification to game /discover ranking.
-- SECURITY INVOKER (default) so current_user reflects the caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_clubs_trust_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.recognition_tier := 'COMMUNITY';
      NEW.reputation_score := 0;
      NEW.reputation_signals := '{}'::jsonb;  -- clubs.reputation_signals is NOT NULL
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
      NEW.verification_source := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.recognition_tier := OLD.recognition_tier;
      NEW.reputation_score := OLD.reputation_score;
      NEW.reputation_signals := OLD.reputation_signals;
      NEW.verified_at := OLD.verified_at;
      NEW.verified_by := OLD.verified_by;
      NEW.verification_source := OLD.verification_source;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_clubs_trust ON public.clubs;
CREATE TRIGGER trg_guard_clubs_trust
  BEFORE INSERT OR UPDATE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_clubs_trust_columns();

-- ---------------------------------------------------------------------------
-- recompute_reputation() — full recompute for all clubs + non-merged players.
-- Runs as definer so the trust-column guards pass through (current_user is the
-- owner, not authenticated). Only touches rows whose score actually changed
-- (or was never computed) to keep write churn low.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_reputation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Clubs: members·2 + events_held·3 + honors·10 + fixtures_completed·2 + completeness·3
  WITH stats AS (
    SELECT c.id,
      (SELECT count(*) FROM public.club_memberships m WHERE m.club_id = c.id) AS members,
      (SELECT count(*) FROM public.club_events e WHERE e.club_id = c.id AND e.starts_at < now()) AS events_held,
      (SELECT count(*) FROM public.honors h WHERE h.club_id = c.id) AS honors,
      (SELECT count(*) FROM public.fixtures f JOIN public.leagues l ON l.id = f.league_id
         WHERE l.club_id = c.id AND f.status = 'COMPLETED') AS fixtures_completed,
      ( (c.description IS NOT NULL AND c.description <> '')::int
      + (c.city IS NOT NULL AND c.city <> '')::int
      + (c.country IS NOT NULL AND c.country <> '')::int
      + (c.contact_email IS NOT NULL AND c.contact_email <> '')::int
      + (c.website IS NOT NULL AND c.website <> '')::int
      + (c.founded_year IS NOT NULL)::int
      + (c.latitude IS NOT NULL)::int ) AS completeness
    FROM public.clubs c
  ), scored AS (
    SELECT id,
      (2*members + 3*events_held + 10*honors + 2*fixtures_completed + 3*completeness) AS score,
      jsonb_build_object(
        'members', members, 'events_held', events_held, 'honors', honors,
        'fixtures_completed', fixtures_completed, 'completeness', completeness
      ) AS signals_core
    FROM stats
  )
  UPDATE public.clubs c SET
    reputation_score = s.score,
    reputation_signals = s.signals_core || jsonb_build_object('computed_at', now())
  FROM scored s
  WHERE c.id = s.id
    -- Refresh when any signal component changed (also covers score changes and
    -- first run), even if the weighted score nets to the same total.
    AND (COALESCE(c.reputation_signals, '{}'::jsonb) - 'computed_at') IS DISTINCT FROM s.signals_core;

  -- Players: memberships·2 + honors·8 + captaincies·4 + completeness·3
  WITH pstats AS (
    SELECT p.id,
      ( (SELECT count(*) FROM public.club_memberships m WHERE m.person_id = p.id)
      + (SELECT count(*) FROM public.team_memberships tm WHERE tm.person_id = p.id) ) AS memberships,
      (SELECT count(*) FROM public.honor_squad_members hs WHERE hs.person_id = p.id) AS honors,
      (SELECT count(*) FROM public.honors h WHERE h.captain_person_id = p.id) AS captaincies,
      ( (p.bio IS NOT NULL AND p.bio <> '')::int
      + (p.city IS NOT NULL AND p.city <> '')::int
      + (p.primary_role IS NOT NULL)::int
      + (p.photo IS NOT NULL AND p.photo <> '')::int
      + (p.availability IS NOT NULL AND p.availability <> '')::int
      + ( (p.batting_style IS NOT NULL AND p.batting_style <> '')
         OR (p.bowling_style IS NOT NULL AND p.bowling_style <> '') )::int ) AS completeness
    FROM public.player_profiles p
    WHERE p.merged_into_id IS NULL
  ), pscored AS (
    SELECT id,
      (2*memberships + 8*honors + 4*captaincies + 3*completeness) AS score,
      jsonb_build_object(
        'memberships', memberships, 'honors', honors, 'captaincies', captaincies,
        'completeness', completeness
      ) AS signals_core
    FROM pstats
  )
  UPDATE public.player_profiles p SET
    reputation_score = s.score,
    reputation_signals = s.signals_core || jsonb_build_object('computed_at', now())
  FROM pscored s
  WHERE p.id = s.id
    AND (COALESCE(p.reputation_signals, '{}'::jsonb) - 'computed_at') IS DISTINCT FROM s.signals_core;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_reputation() FROM PUBLIC, anon, authenticated;

-- Populate scores now so /discover reflects reputation immediately (idempotent).
SELECT public.recompute_reputation();
