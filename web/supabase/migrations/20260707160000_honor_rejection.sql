-- Close the deferred HIGH from PR #20's review: a malicious host of a tournament
-- a club DID join can mint a verified honor with a defamatory title (= league
-- name), and conclude_tournament re-mints TOSSUP_VERIFIED honors on every
-- re-conclude, so a plain delete doesn't stick. Give the club a durable opt-out:
-- reject a verified honor to remove it AND block that tournament from re-minting.

CREATE TABLE public.honor_rejections (
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  rejected_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  rejected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, league_id)
);
ALTER TABLE public.honor_rejections ENABLE ROW LEVEL SECURITY;

-- Club admins manage their own club's rejections (used by the functions + a
-- future "allow again" UI). No public read — a rejection is private club state.
CREATE POLICY "hrej_admin_read" ON public.honor_rejections
  FOR SELECT TO authenticated USING (is_scope_admin(auth.uid(), 'club', club_id));
CREATE POLICY "hrej_admin_insert" ON public.honor_rejections
  FOR INSERT TO authenticated
  WITH CHECK (is_scope_admin(auth.uid(), 'club', club_id) AND rejected_by = auth.uid());
CREATE POLICY "hrej_admin_delete" ON public.honor_rejections
  FOR DELETE TO authenticated USING (is_scope_admin(auth.uid(), 'club', club_id));

-- Reject a verified honor: record the rejection + purge this club's verified
-- honors from that tournament. Idempotent; club-admin-only.
CREATE OR REPLACE FUNCTION public.reject_tournament_honor(p_honor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h record;
BEGIN
  SELECT * INTO h FROM honors WHERE id = p_honor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'honor % not found', p_honor_id; END IF;
  IF h.source <> 'TOSSUP_VERIFIED' OR h.league_id IS NULL THEN
    RAISE EXCEPTION 'only a tournament-verified honor can be rejected';
  END IF;
  IF NOT is_scope_admin(auth.uid(), 'club', h.club_id) THEN
    RAISE EXCEPTION 'only a club admin can reject its honors';
  END IF;
  -- Same lock conclude_tournament takes, so a reject can't race a concurrent
  -- conclude that already evaluated NOT EXISTS honor_rejections and would
  -- otherwise re-mint the honor after this DELETE.
  PERFORM pg_advisory_xact_lock(hashtextextended(h.league_id::text, 99));
  INSERT INTO honor_rejections (club_id, league_id, rejected_by)
    VALUES (h.club_id, h.league_id, auth.uid())
    ON CONFLICT (club_id, league_id) DO NOTHING;
  -- League-scoped: removes ALL of this club's verified honors from that
  -- tournament (champion AND runner-up), matching "this tournament isn't us".
  DELETE FROM honors
    WHERE club_id = h.club_id AND league_id = h.league_id AND source = 'TOSSUP_VERIFIED';
END $$;
REVOKE EXECUTE ON FUNCTION public.reject_tournament_honor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_tournament_honor(uuid) TO authenticated;

-- Undo a rejection (API-level recourse; no UI yet — a "restore" affordance is a
-- deferred follow-up). Even after this, the honor reappears only when the host
-- next concludes the tournament, so from the club's side a reject is effectively
-- durable — the confirm copy says so.
CREATE OR REPLACE FUNCTION public.allow_tournament_honors(p_club_id uuid, p_league_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_scope_admin(auth.uid(), 'club', p_club_id) THEN
    RAISE EXCEPTION 'only a club admin can change its honor settings';
  END IF;
  DELETE FROM honor_rejections WHERE club_id = p_club_id AND league_id = p_league_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.allow_tournament_honors(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allow_tournament_honors(uuid, uuid) TO authenticated;

-- conclude_tournament: additionally skip clubs that have rejected this
-- tournament's verified honors, so a rejected honor never re-mints.
CREATE OR REPLACE FUNCTION public.conclude_tournament(
  p_league_id uuid, p_champion_team_id uuid, p_runner_up_team_id uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lg record; v_year int; v_count int;
BEGIN
  IF NOT is_scope_admin(auth.uid(), 'league', p_league_id) THEN
    RAISE EXCEPTION 'only a tournament host can conclude it';
  END IF;

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

  v_year := GREATEST(1850, LEAST(2100, EXTRACT(YEAR FROM COALESCE(lg.end_date, lg.start_date, now()))::int));

  DELETE FROM honors WHERE league_id = p_league_id AND source = 'TOSSUP_VERIFIED';

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
      AND NOT EXISTS (
        SELECT 1 FROM honor_rejections hr
        WHERE hr.club_id = tt.club_id AND hr.league_id = p_league_id
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.conclude_tournament(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conclude_tournament(uuid, uuid, uuid) TO authenticated;
