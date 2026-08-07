-- Phase F reputation v2: recency/decay + an admin "recompute now" path. Extends
-- the v1 scorer (20260711120000) — same low-churn signal-vector gate, same
-- REVOKE/cron — by adding recency-weighted signals so an ACTIVE club/player
-- outranks a dormant one with equal lifetime totals. The per-signal breakdown is
-- surfaced on the club/player pages (reputation_signals jsonb).

-- Full recompute (0-arg signature unchanged, so the existing pg_cron call still
-- binds). New signals: clubs get recent_events / recent_fixtures (last 90 days,
-- bonus weight on top of the lifetime counts); players get recent_memberships.
CREATE OR REPLACE FUNCTION public.recompute_reputation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Clubs: members·2 + events_held·3 + honors·10 + fixtures_completed·2
  --      + completeness·3 + recent_events·4 + recent_fixtures·3   (recency boost)
  WITH stats AS (
    SELECT c.id,
      (SELECT count(*) FROM public.club_memberships m WHERE m.club_id = c.id) AS members,
      (SELECT count(*) FROM public.club_events e WHERE e.club_id = c.id AND e.starts_at < now()) AS events_held,
      (SELECT count(*) FROM public.club_events e WHERE e.club_id = c.id
         AND e.starts_at < now() AND e.starts_at >= now() - interval '90 days') AS recent_events,
      (SELECT count(*) FROM public.honors h WHERE h.club_id = c.id) AS honors,
      (SELECT count(*) FROM public.fixtures f JOIN public.leagues l ON l.id = f.league_id
         WHERE l.club_id = c.id AND f.status = 'COMPLETED') AS fixtures_completed,
      (SELECT count(*) FROM public.fixtures f JOIN public.leagues l ON l.id = f.league_id
         WHERE l.club_id = c.id AND f.status = 'COMPLETED'
           AND f.updated_at >= now() - interval '90 days') AS recent_fixtures,
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
      (2*members + 3*events_held + 10*honors + 2*fixtures_completed + 3*completeness
        + 4*recent_events + 3*recent_fixtures) AS score,
      jsonb_build_object(
        'members', members, 'events_held', events_held, 'honors', honors,
        'fixtures_completed', fixtures_completed, 'completeness', completeness,
        'recent_events', recent_events, 'recent_fixtures', recent_fixtures
      ) AS signals_core
    FROM stats
  )
  UPDATE public.clubs c SET
    reputation_score = s.score,
    reputation_signals = s.signals_core || jsonb_build_object('computed_at', now())
  FROM scored s
  WHERE c.id = s.id
    AND (COALESCE(c.reputation_signals, '{}'::jsonb) - 'computed_at') IS DISTINCT FROM s.signals_core;

  -- Players: memberships·2 + honors·8 + captaincies·4 + completeness·3
  --        + recent_memberships·2   (recency boost)
  WITH pstats AS (
    SELECT p.id,
      ( (SELECT count(*) FROM public.club_memberships m WHERE m.person_id = p.id)
      + (SELECT count(*) FROM public.team_memberships tm WHERE tm.person_id = p.id) ) AS memberships,
      (SELECT count(*) FROM public.club_memberships m WHERE m.person_id = p.id
         AND m.created_at >= now() - interval '90 days') AS recent_memberships,
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
      (2*memberships + 8*honors + 4*captaincies + 3*completeness + 2*recent_memberships) AS score,
      jsonb_build_object(
        'memberships', memberships, 'honors', honors, 'captaincies', captaincies,
        'completeness', completeness, 'recent_memberships', recent_memberships
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

-- recent_fixtures keys off fixtures.updated_at to mean "completed recently", but
-- fixtures had no updated_at maintenance (it stuck at its INSERT default). Track
-- it on every update so a status→COMPLETED transition bumps it and the recency
-- signal is accurate.
CREATE OR REPLACE FUNCTION public.fixtures_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fixtures_touch_updated_at ON public.fixtures;
CREATE TRIGGER trg_fixtures_touch_updated_at
  BEFORE UPDATE ON public.fixtures
  FOR EACH ROW EXECUTE FUNCTION public.fixtures_touch_updated_at();

-- Single-row throttle so a manual recompute can't be looped to impose repeated
-- full-table scans. Definer-only (RLS on, no policies).
CREATE TABLE IF NOT EXISTS public.reputation_recompute_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_run timestamptz NOT NULL DEFAULT to_timestamp(0)
);
INSERT INTO public.reputation_recompute_state (id) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE public.reputation_recompute_state ENABLE ROW LEVEL SECURITY;

-- Admin "recompute now": a scope admin can force a refresh (e.g. after adding a
-- trophy) instead of waiting for the nightly cron. Gated to a caller who admins
-- at least one club — prevents an arbitrary signed-in user triggering the full
-- recompute. The recompute is idempotent + low-churn-gated, so this is cheap.
CREATE OR REPLACE FUNCTION public.request_reputation_recompute()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_claimed int;
BEGIN
  -- Reuse the canonical admin-clubs reader (covers owner_id + OWNER/ADMIN
  -- memberships); auth.uid() inside it still resolves to the caller.
  IF NOT EXISTS (SELECT 1 FROM public.list_my_admin_clubs()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  -- Throttle: atomically claim a >=2-minute window (the WHERE + row lock
  -- serializes concurrent callers). If nothing was claimed, a manual recompute
  -- already ran recently — no-op (the nightly cron and the prior run keep scores
  -- fresh), so the caller still sees success.
  UPDATE public.reputation_recompute_state
    SET last_run = now()
    WHERE last_run <= now() - interval '2 minutes';
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN
    RETURN;
  END IF;
  PERFORM public.recompute_reputation();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_reputation_recompute() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_reputation_recompute() TO authenticated;

-- Recompute now so the new recency signals populate immediately (idempotent).
SELECT public.recompute_reputation();
