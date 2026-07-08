-- Close the verified-honor forge vector found in review of PR #20 (confirmed by
-- three independent review agents).
--
-- conclude_tournament trusted tournament_teams.club_id as proof a club opted in,
-- but that link has back doors: any signed-in user can create a tournament (become
-- its host via leagues.owner_id), then set a team's club_id directly via
-- hostAddTeam (tteams write RLS gates only is_scope_admin('league')), or launder
-- it through treg_admin_update. Either forges a TOSSUP_VERIFIED trophy into a
-- non-consenting club's public cabinet, re-mintable on every re-conclude.
--
-- Fix: mint verified honors ONLY when a consented, immutable, APPROVED
-- registration proves the club opted in — re-verified live at mint time.

-- (1) A registration's (user_id, club_id) IS the consent identity. Pin them
--     immutable so a league admin's UPDATE (e.g. status change) can't launder a
--     victim club / a club-admin's user id onto someone else's registration.
CREATE OR REPLACE FUNCTION public.tournament_registrations_pin_consent()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'registration user_id is immutable';
  END IF;
  IF NEW.club_id IS DISTINCT FROM OLD.club_id THEN
    RAISE EXCEPTION 'registration club_id is immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_treg_pin_consent ON public.tournament_registrations;
CREATE TRIGGER trg_treg_pin_consent BEFORE UPDATE ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.tournament_registrations_pin_consent();

-- (2) Defense in depth: a host may only set a team's club_id to a club they
--     administer (or NULL). The SECURITY DEFINER approve path bypasses RLS, so
--     consented registrations still flow through — this only blocks a host from
--     hand-stamping an arbitrary club onto a team.
DROP POLICY IF EXISTS "tteams_admin_insert" ON public.tournament_teams;
CREATE POLICY "tteams_admin_insert" ON public.tournament_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    is_scope_admin(auth.uid(), 'league', league_id)
    AND (club_id IS NULL OR is_scope_admin(auth.uid(), 'club', club_id))
  );
DROP POLICY IF EXISTS "tteams_admin_update" ON public.tournament_teams;
CREATE POLICY "tteams_admin_update" ON public.tournament_teams
  FOR UPDATE TO authenticated
  USING (is_scope_admin(auth.uid(), 'league', league_id))
  WITH CHECK (
    is_scope_admin(auth.uid(), 'league', league_id)
    AND (club_id IS NULL OR is_scope_admin(auth.uid(), 'club', club_id))
  );

-- (3) Only the conclude path (SECURITY DEFINER) may write TOSSUP_VERIFIED. A club
--     admin's direct honor insert is limited to SELF_REPORTED, so the verified
--     badge can't be self-forged and a hand-added row can't collide with
--     conclude's verified-honor rewrite.
DROP POLICY IF EXISTS "honors_admin_insert" ON public.honors;
CREATE POLICY "honors_admin_insert" ON public.honors
  FOR INSERT TO authenticated
  WITH CHECK (is_scope_admin(auth.uid(), 'club', club_id) AND source = 'SELF_REPORTED');

-- (4) conclude_tournament: mint verified honors ONLY for clubs with a consented,
--     APPROVED registration whose submitter actually administers that club. That
--     submitter-admin status is re-checked live, and (1) keeps the registration
--     identity immutable, so neither the direct tournament_teams.club_id path nor
--     the treg_admin_update path can forge it. Returns the honor count so the UI
--     can't claim silverware landed when none did.
DROP FUNCTION IF EXISTS public.conclude_tournament(uuid, uuid, uuid);
CREATE FUNCTION public.conclude_tournament(
  p_league_id uuid, p_champion_team_id uuid, p_runner_up_team_id uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lg record; v_year int; v_count int;
BEGIN
  IF NOT is_scope_admin(auth.uid(), 'league', p_league_id) THEN
    RAISE EXCEPTION 'only a tournament host can conclude it';
  END IF;

  -- Serialize re-conclude / concurrent conclude so the DELETE-then-INSERT of
  -- verified honors can't double-write.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_league_id::text, 99));

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

  -- Clamp to the honors year CHECK range so a typo'd league date can't abort.
  v_year := GREATEST(1850, LEAST(2100, EXTRACT(YEAR FROM COALESCE(lg.end_date, lg.start_date, now()))::int));

  DELETE FROM honors WHERE league_id = p_league_id AND source = 'TOSSUP_VERIFIED';

  -- A verified honor must be publicly auditable, so only mint for PUBLIC
  -- tournaments. team_id is left NULL (club_team_id is host-settable/unverified).
  WITH ins AS (
    INSERT INTO honors (club_id, team_id, league_id, title, result, year, season_label, source, created_by)
    SELECT tt.club_id, NULL, p_league_id, lg.name, v.result, v_year,
           lg.season, 'TOSSUP_VERIFIED', auth.uid()
    FROM (VALUES (p_champion_team_id, 'CHAMPION'), (p_runner_up_team_id, 'RUNNER_UP')) AS v(team_id, result)
    JOIN tournament_teams tt ON tt.id = v.team_id
    WHERE v.team_id IS NOT NULL AND tt.club_id IS NOT NULL
      AND (lg.visibility = 'PUBLIC' OR lg.visibility IS NULL)
      AND EXISTS (
        SELECT 1 FROM tournament_registrations reg
        WHERE reg.league_id = p_league_id
          AND reg.club_id = tt.club_id
          AND reg.status = 'APPROVED'
          AND is_scope_admin(reg.user_id, 'club', reg.club_id)
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.conclude_tournament(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conclude_tournament(uuid, uuid, uuid) TO authenticated;
