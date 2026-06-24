-- Phase 3 (identity model): merge two Person records (same human, added twice).
-- One SECURITY DEFINER transaction: advisory-locked (idempotent), blocks merging
-- across two different user accounts, re-points every person reference, dedupes
-- UNIQUE(person, scope) membership collisions (keeping the stronger role), and
-- tombstones the loser via merged_into_id. A completeness guard reads
-- information_schema and FAILS if any person-referencing FK column is not
-- explicitly handled here — so a future schema addition can't silently orphan
-- rows on merge (this is how the Phase 3b practice consolidation will be caught).

-- organization_role strength (higher index = stronger), for collision upgrades.
CREATE OR REPLACE FUNCTION public.role_rank(r public.organization_role)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT array_position(ARRAY['MEMBER','MODERATOR','ADMIN','OWNER']::public.organization_role[], r)
$$;

-- Re-point one membership table from loser->winner, deduping per-scope collisions.
CREATE OR REPLACE FUNCTION public.merge_membership(p_table text, p_scope_col text, p_loser uuid, p_winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- where both already belong to the same scope, upgrade winner to the stronger role
  EXECUTE format($f$
    UPDATE %1$I w SET role = l.role
    FROM %1$I l
    WHERE w.person_id = $1 AND l.person_id = $2 AND w.%2$I = l.%2$I
      AND role_rank(l.role) > role_rank(w.role)
  $f$, p_table, p_scope_col) USING p_winner, p_loser;
  -- drop loser rows that would collide with an existing winner row
  EXECUTE format($f$
    DELETE FROM %1$I l WHERE l.person_id = $2
      AND EXISTS (SELECT 1 FROM %1$I w WHERE w.person_id = $1 AND w.%2$I = l.%2$I)
  $f$, p_table, p_scope_col) USING p_winner, p_loser;
  -- move the rest
  EXECUTE format($f$ UPDATE %1$I SET person_id = $1 WHERE person_id = $2 $f$, p_table) USING p_winner, p_loser;
END $$;

CREATE OR REPLACE FUNCTION public.merge_persons(p_loser uuid, p_winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l_user uuid; w_user uuid; unhandled text;
BEGIN
  IF p_loser = p_winner THEN RAISE EXCEPTION 'cannot merge a person into itself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM player_profiles WHERE id = p_loser) THEN
    RAISE EXCEPTION 'loser person % not found', p_loser; END IF;
  IF NOT EXISTS (SELECT 1 FROM player_profiles WHERE id = p_winner AND merged_into_id IS NULL) THEN
    RAISE EXCEPTION 'winner person % not found or itself merged away', p_winner; END IF;

  -- serialize concurrent merges touching either id (idempotency)
  PERFORM pg_advisory_xact_lock(
    hashtextextended(least(p_loser::text, p_winner::text) || greatest(p_loser::text, p_winner::text), 42));

  -- idempotent: already merged into this winner
  IF (SELECT merged_into_id FROM player_profiles WHERE id = p_loser) = p_winner THEN RETURN; END IF;

  SELECT user_id INTO l_user FROM player_profiles WHERE id = p_loser;
  SELECT user_id INTO w_user FROM player_profiles WHERE id = p_winner;
  IF l_user IS NOT NULL AND w_user IS NOT NULL AND l_user <> w_user THEN
    RAISE EXCEPTION 'cannot merge: persons are linked to different users — resolve the link first';
  END IF;

  -- completeness guard: every FK column referencing player_profiles(id) must be handled below
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

  -- if only the loser is user-linked, carry the link to the winner BEFORE moving
  -- admin memberships (else enforce_admin_is_user would reject them on the winner)
  IF w_user IS NULL AND l_user IS NOT NULL THEN
    UPDATE player_profiles SET user_id = l_user WHERE id = p_winner;
  END IF;

  PERFORM merge_membership('club_memberships', 'club_id', p_loser, p_winner);
  PERFORM merge_membership('team_memberships', 'team_id', p_loser, p_winner);
  PERFORM merge_membership('league_memberships', 'league_id', p_loser, p_winner);
  PERFORM merge_membership('tournament_team_memberships', 'tournament_team_id', p_loser, p_winner);

  UPDATE users SET primary_person_id = p_winner WHERE primary_person_id = p_loser;

  UPDATE player_profiles SET merged_into_id = p_winner, updated_at = now() WHERE id = p_loser;
END $$;
