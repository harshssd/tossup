-- Phase B-part-2: conclude a tournament -> record champion/runner-up + mint
-- TOSSUP_VERIFIED honors into the winning clubs' cabinets (the flywheel:
-- hosting on TossUp mints verified silverware that pulls clubs to their pages).
--
-- Trust model: a verified honor lands in a *club* cabinet but is written by the
-- *tournament host*. To keep that non-forgeable, the club->team link must be the
-- club's own opt-in: a registration may only carry a club_id if the submitting
-- user administers that club (tightened below). conclude_tournament then writes
-- verified honors ONLY to teams whose club_id came through that consented path.

-- 1. Champion / runner-up recorded on the league (powers the champions banner).
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS champion_team_id uuid REFERENCES public.tournament_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS runner_up_team_id uuid REFERENCES public.tournament_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concluded_at timestamptz;

-- 2. Register-time club consent: a registration's club_id must be a club the
--    submitting user administers (was: user_id=self + PENDING only). This is
--    what makes a later verified honor into that club's cabinet legitimate.
DROP POLICY IF EXISTS "treg_self_insert" ON public.tournament_registrations;
CREATE POLICY "treg_self_insert" ON public.tournament_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'PENDING'
    AND (club_id IS NULL OR public.is_scope_admin(auth.uid(), 'club', club_id))
  );

-- 3. Clubs the caller administers — feeds the "register as your club" picker.
CREATE OR REPLACE FUNCTION public.list_my_admin_clubs()
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT c.id, c.name, c.slug FROM clubs c
  WHERE auth.uid() IS NOT NULL AND is_scope_admin(auth.uid(), 'club', c.id)
  ORDER BY c.name
$$;
REVOKE EXECUTE ON FUNCTION public.list_my_admin_clubs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_admin_clubs() TO authenticated;

-- 4. Conclude: record champion/runner-up, then (re)mint verified honors.
CREATE OR REPLACE FUNCTION public.conclude_tournament(
  p_league_id uuid, p_champion_team_id uuid, p_runner_up_team_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lg record; v_year int;
BEGIN
  IF NOT is_scope_admin(auth.uid(), 'league', p_league_id) THEN
    RAISE EXCEPTION 'only a tournament host can conclude it';
  END IF;

  SELECT * INTO lg FROM leagues WHERE id = p_league_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament % not found', p_league_id; END IF;

  IF p_champion_team_id IS NULL THEN RAISE EXCEPTION 'a champion is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tournament_teams WHERE id = p_champion_team_id AND league_id = p_league_id) THEN
    RAISE EXCEPTION 'champion team is not in this tournament';
  END IF;
  IF p_runner_up_team_id IS NOT NULL THEN
    IF p_runner_up_team_id = p_champion_team_id THEN RAISE EXCEPTION 'runner-up must differ from champion'; END IF;
    IF NOT EXISTS (SELECT 1 FROM tournament_teams WHERE id = p_runner_up_team_id AND league_id = p_league_id) THEN
      RAISE EXCEPTION 'runner-up team is not in this tournament';
    END IF;
  END IF;

  UPDATE leagues SET champion_team_id = p_champion_team_id,
                     runner_up_team_id = p_runner_up_team_id,
                     concluded_at = now(), updated_at = now()
    WHERE id = p_league_id;

  v_year := EXTRACT(YEAR FROM COALESCE(lg.end_date, lg.start_date, now()))::int;

  -- Idempotent re-conclude: clear this tournament's prior verified honors and
  -- rewrite from the current champion/runner-up. SELF_REPORTED honors a club
  -- added by hand are left untouched.
  DELETE FROM honors WHERE league_id = p_league_id AND source = 'TOSSUP_VERIFIED';

  -- Champion + runner-up honors, only for teams a club opted into (club_id set
  -- via the consented registration path). team_id links a standing club team.
  INSERT INTO honors (club_id, team_id, league_id, title, result, year, season_label, source, created_by)
  SELECT tt.club_id, tt.club_team_id, p_league_id, lg.name, v.result, v_year,
         lg.season, 'TOSSUP_VERIFIED', auth.uid()
  FROM (VALUES (p_champion_team_id, 'CHAMPION'), (p_runner_up_team_id, 'RUNNER_UP')) AS v(team_id, result)
  JOIN tournament_teams tt ON tt.id = v.team_id
  WHERE v.team_id IS NOT NULL AND tt.club_id IS NOT NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.conclude_tournament(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conclude_tournament(uuid, uuid, uuid) TO authenticated;
