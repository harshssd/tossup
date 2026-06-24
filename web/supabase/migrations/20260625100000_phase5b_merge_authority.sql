-- Phase 5b: in-function caller-authority for merge_persons + re-grant to
-- authenticated, so admins can dedup rosters (and users can dedup their own
-- identities) from the app instead of merge being service_role-only.
--
-- Authority (only enforced when called by a real user — auth.uid() IS NOT NULL;
-- service_role / trusted server bypasses): the caller may merge iff they
--   (a) own BOTH Persons (self-service dedup), or
--   (b) administer a scope both Persons share (roster dedup).
-- The different-user block (already present) still applies on top.
--
-- This is also how "link a player to a user" is realized: signup always makes a
-- self-Person, so merging an account-less roster Person into the user's
-- account-Person carries the user link onto the survivor.
--
-- Everything else in the function is unchanged from 20260624123000.

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
  -- COALESCE(...,false): the self-service term is NULL (not false) when the
  -- winner is unlinked, which would otherwise make NOT(...) NULL and skip the
  -- RAISE (three-valued-logic hole) — wrap so a non-match always denies.
  IF auth.uid() IS NOT NULL AND NOT COALESCE((
       (w_user = auth.uid() AND (l_user = auth.uid() OR l_user IS NULL))
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

  DELETE FROM external_links l WHERE l.entity_id = p_loser
    AND EXISTS (SELECT 1 FROM external_links w WHERE w.entity_id = p_winner
                AND w.source_id = l.source_id AND w.entity_type = l.entity_type);
  UPDATE external_links SET entity_id = p_winner WHERE entity_id = p_loser;

  UPDATE users SET primary_person_id = p_winner WHERE primary_person_id = p_loser;

  UPDATE player_profiles SET merged_into_id = p_winner, updated_at = now() WHERE id = p_loser;
END $$;

-- Re-grant: authenticated may now call (gated by the in-function authority check);
-- service_role retained. anon stays revoked (must target PUBLIC, not just anon).
REVOKE EXECUTE ON FUNCTION public.merge_persons(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_persons(uuid, uuid) TO authenticated, service_role;
