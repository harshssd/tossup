-- Team registration: atomic approval. Approving a registration must (a) create
-- the tournament_team and (b) mark the registration APPROVED together — doing it
-- as two client writes risks an orphan team or a stuck-PENDING row if one fails.
--
-- SECURITY DEFINER so it can write past RLS, but it self-checks caller authority
-- via is_scope_admin(auth.uid(), ...) — auth.uid() reads the caller's JWT, which
-- survives into the definer context. Idempotent: re-approving returns the
-- existing team; the team insert dedups on UNIQUE(league_id, name).
CREATE OR REPLACE FUNCTION public.approve_tournament_registration(p_reg_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_team_id uuid;
BEGIN
  SELECT * INTO r FROM tournament_registrations WHERE id = p_reg_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'registration % not found', p_reg_id; END IF;

  IF NOT public.is_scope_admin(auth.uid(), 'league', r.league_id) THEN
    RAISE EXCEPTION 'only a tournament admin can approve registrations';
  END IF;

  -- create the team (dedupe if a team of that name already exists in the league)
  INSERT INTO tournament_teams (league_id, name, club_id, captain_name, contact_email, contact_phone)
  VALUES (r.league_id, r.team_name, r.club_id, r.contact_name, r.contact_email, r.contact_phone)
  ON CONFLICT (league_id, name) DO NOTHING;

  SELECT id INTO v_team_id FROM tournament_teams WHERE league_id = r.league_id AND name = r.team_name;

  UPDATE tournament_registrations SET status = 'APPROVED' WHERE id = p_reg_id;
  RETURN v_team_id;
END $$;

-- Callable by signed-in users; the in-function is_scope_admin check is the gate.
REVOKE EXECUTE ON FUNCTION public.approve_tournament_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_tournament_registration(uuid) TO authenticated;
