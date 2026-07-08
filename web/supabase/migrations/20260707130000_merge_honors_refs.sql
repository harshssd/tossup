-- Phase B follow-up: teach merge_persons about the honors FKs.
--
-- The honors migration added two FKs to player_profiles.id — honors.captain_person_id
-- and honor_squad_members.person_id. merge_persons has a completeness guard that
-- RAISEs on any unhandled person FK, so adding honors *broke every merge* until the
-- function re-points those refs and allowlists the two columns. This keeps the
-- "merge/link keeps history intact" promise: a merged legend's captaincy and squad
-- appearances follow onto the surviving Person.
--
-- Also tightens hsquad_admin_insert so the direct-insert path enforces the same
-- club-roster membership that create_honor already checks (a club admin can't
-- attach an arbitrary/unrelated Person to an honor's squad, which would falsely
-- surface on that person's public profile ribbon).

CREATE OR REPLACE FUNCTION public.merge_persons(p_loser uuid, p_winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l_user uuid; w_user uuid; l_merged uuid; unhandled text;
BEGIN
  IF p_loser = p_winner THEN RAISE EXCEPTION 'cannot merge a person into itself'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(least(p_loser, p_winner)::text, 42));
  PERFORM pg_advisory_xact_lock(hashtextextended(greatest(p_loser, p_winner)::text, 42));

  IF NOT EXISTS (SELECT 1 FROM player_profiles WHERE id = p_loser) THEN
    RAISE EXCEPTION 'loser person % not found', p_loser; END IF;
  IF NOT EXISTS (SELECT 1 FROM player_profiles WHERE id = p_winner AND merged_into_id IS NULL) THEN
    RAISE EXCEPTION 'winner person % not found or itself merged away', p_winner; END IF;

  SELECT merged_into_id INTO l_merged FROM player_profiles WHERE id = p_loser;
  IF l_merged = p_winner THEN RETURN; END IF;                 -- idempotent
  IF l_merged IS NOT NULL THEN
    RAISE EXCEPTION 'loser % is already merged into another person', p_loser; END IF;

  SELECT user_id INTO l_user FROM player_profiles WHERE id = p_loser;
  SELECT user_id INTO w_user FROM player_profiles WHERE id = p_winner;
  IF l_user IS NOT NULL AND w_user IS NOT NULL AND l_user <> w_user THEN
    RAISE EXCEPTION 'cannot merge: persons are linked to different users — resolve the link first';
  END IF;

  -- Caller authority (Phase 5b). Skipped for the trusted server (null uid).
  -- COALESCE(...,false) closes the three-valued-logic hole when the winner is unlinked.
  IF auth.uid() IS NOT NULL AND NOT COALESCE((
       (w_user = auth.uid() AND l_user = auth.uid())
    OR EXISTS (SELECT 1 FROM club_memberships a JOIN club_memberships b ON a.club_id = b.club_id
               WHERE a.person_id = p_loser AND b.person_id = p_winner
                 AND is_scope_admin(auth.uid(), 'club', a.club_id))
    OR EXISTS (SELECT 1 FROM team_memberships a JOIN team_memberships b ON a.team_id = b.team_id
               WHERE a.person_id = p_loser AND b.person_id = p_winner
                 AND is_scope_admin(auth.uid(), 'team', a.team_id))
    OR EXISTS (SELECT 1 FROM league_memberships a JOIN league_memberships b ON a.league_id = b.league_id
               WHERE a.person_id = p_loser AND b.person_id = p_winner
                 AND is_scope_admin(auth.uid(), 'league', a.league_id))
    OR EXISTS (SELECT 1 FROM tournament_team_memberships a JOIN tournament_team_memberships b ON a.tournament_team_id = b.tournament_team_id
               WHERE a.person_id = p_loser AND b.person_id = p_winner
                 AND is_scope_admin(auth.uid(), 'tournament_team', a.tournament_team_id))
  ), false) THEN
    RAISE EXCEPTION 'not authorized to merge these persons';
  END IF;

  -- Completeness guard: every FK into player_profiles.id must be handled below.
  SELECT string_agg(tc.table_name || '.' || kcu.column_name, ', ') INTO unhandled
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    AND ccu.table_name = 'player_profiles' AND ccu.column_name = 'id'
    AND (tc.table_name, kcu.column_name) NOT IN (
      ('club_memberships','person_id'), ('team_memberships','person_id'),
      ('league_memberships','person_id'), ('tournament_team_memberships','person_id'),
      ('honors','captain_person_id'), ('honor_squad_members','person_id'),
      ('player_profiles','merged_into_id'), ('users','primary_person_id')
    );
  IF unhandled IS NOT NULL THEN
    RAISE EXCEPTION 'merge_persons does not handle person FK column(s): % — update the function', unhandled;
  END IF;

  IF w_user IS NULL AND l_user IS NOT NULL THEN
    UPDATE player_profiles SET user_id = l_user WHERE id = p_winner;
  END IF;

  UPDATE player_profiles w SET
    photo = COALESCE(w.photo, l.photo),
    city = COALESCE(w.city, l.city), region = COALESCE(w.region, l.region),
    country = COALESCE(w.country, l.country),
    latitude = COALESCE(w.latitude, l.latitude), longitude = COALESCE(w.longitude, l.longitude),
    bio = COALESCE(w.bio, l.bio),
    contact_email = COALESCE(w.contact_email, l.contact_email),
    contact_phone = COALESCE(w.contact_phone, l.contact_phone),
    primary_role = COALESCE(w.primary_role, l.primary_role),
    batting_style = COALESCE(w.batting_style, l.batting_style),
    bowling_style = COALESCE(w.bowling_style, l.bowling_style),
    availability = COALESCE(w.availability, l.availability),
    current_club_id = COALESCE(w.current_club_id, l.current_club_id),
    reputation_score = GREATEST(w.reputation_score, l.reputation_score),
    recognition_tier = CASE
      WHEN array_position(ARRAY['OFFICIAL','AFFILIATED','COMMUNITY','UNVERIFIED']::recognition_tier[], l.recognition_tier)
         < array_position(ARRAY['OFFICIAL','AFFILIATED','COMMUNITY','UNVERIFIED']::recognition_tier[], w.recognition_tier)
      THEN l.recognition_tier ELSE w.recognition_tier END,
    updated_at = now()
  FROM player_profiles l WHERE w.id = p_winner AND l.id = p_loser;

  PERFORM merge_membership('club_memberships', 'club_id', p_loser, p_winner);
  PERFORM merge_membership('team_memberships', 'team_id', p_loser, p_winner);
  PERFORM merge_membership('league_memberships', 'league_id', p_loser, p_winner);
  PERFORM merge_membership('tournament_team_memberships', 'tournament_team_id', p_loser, p_winner);

  -- Honors: captaincy and squad appearances follow onto the survivor.
  UPDATE honors SET captain_person_id = p_winner WHERE captain_person_id = p_loser;
  -- Squad PK is (honor_id, person_id): move loser rows that don't collide, then
  -- drop any leftover loser rows where the winner is already in that squad.
  UPDATE honor_squad_members s SET person_id = p_winner
    WHERE s.person_id = p_loser
      AND NOT EXISTS (SELECT 1 FROM honor_squad_members w
                      WHERE w.honor_id = s.honor_id AND w.person_id = p_winner);
  DELETE FROM honor_squad_members WHERE person_id = p_loser;

  DELETE FROM external_links l WHERE l.entity_id = p_loser
    AND EXISTS (SELECT 1 FROM external_links w WHERE w.entity_id = p_winner
                AND w.source_id = l.source_id AND w.entity_type = l.entity_type);
  UPDATE external_links SET entity_id = p_winner WHERE entity_id = p_loser;

  UPDATE users SET primary_person_id = p_winner WHERE primary_person_id = p_loser;

  UPDATE player_profiles SET merged_into_id = p_winner, updated_at = now() WHERE id = p_loser;
END $$;

REVOKE EXECUTE ON FUNCTION public.merge_persons(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_persons(uuid, uuid) TO authenticated, service_role;

-- Drop the unused in-place UPDATE policy on honors: this PR has no edit UI, and
-- a direct PATCH could set captain_person_id to a non-roster Person (the roster
-- check lives only in create_honor) — the same impersonation class as the squad
-- insert. Edits are delete + re-add for now; a future edit feature re-adds an
-- UPDATE policy with a captain-roster check. (Also moots updated_at staleness.)
DROP POLICY IF EXISTS "honors_admin_update" ON public.honors;

-- Tighten the direct squad-insert path to match create_honor's roster check.
DROP POLICY IF EXISTS "hsquad_admin_insert" ON public.honor_squad_members;
CREATE POLICY "hsquad_admin_insert" ON public.honor_squad_members
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.honors h
    WHERE h.id = honor_id
      AND public.is_scope_admin(auth.uid(), 'club', h.club_id)
      AND EXISTS (SELECT 1 FROM public.club_memberships m
                  WHERE m.club_id = h.club_id AND m.person_id = honor_squad_members.person_id)
  ));
