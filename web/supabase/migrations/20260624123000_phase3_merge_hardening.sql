-- Phase 3 hardening (review findings on the destructive merge_persons):
--  1. Lock these SECURITY DEFINER functions to service_role (anon AND any
--     authenticated user could otherwise RPC merge_persons to tombstone/merge
--     arbitrary persons — there's no in-function caller-authority check yet;
--     that lands with the Phase 5 admin UI which will re-grant + gate).
--  2. Per-person advisory locks (sorted, deadlock-free) with liveness re-checked
--     AFTER the lock — the old pair-hash lock did NOT serialize chained merges
--     sharing a node (A->B concurrent with B->C orphaned rows onto a tombstone).
--  3. Re-point external_links (polymorphic PLAYER ref, no FK — invisible to the
--     information_schema completeness guard) so ingestion mappings aren't stranded.
--  4. Carry loser-only profile data onto a sparse winner (don't bury the richer
--     record on the tombstone).
--  5. CHECK forbidding a self-merge cycle (defense for the player-page redirect).

ALTER TABLE public.player_profiles
  DROP CONSTRAINT IF EXISTS player_profiles_no_self_merge;
ALTER TABLE public.player_profiles
  ADD CONSTRAINT player_profiles_no_self_merge CHECK (merged_into_id IS NULL OR merged_into_id <> id);

CREATE OR REPLACE FUNCTION public.merge_persons(p_loser uuid, p_winner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l_user uuid; w_user uuid; l_merged uuid; unhandled text;
BEGIN
  IF p_loser = p_winner THEN RAISE EXCEPTION 'cannot merge a person into itself'; END IF;

  -- Lock BOTH persons in a deterministic (sorted) order so chained merges that
  -- share a node serialize on the shared id; deadlock-free.
  PERFORM pg_advisory_xact_lock(hashtextextended(least(p_loser, p_winner)::text, 42));
  PERFORM pg_advisory_xact_lock(hashtextextended(greatest(p_loser, p_winner)::text, 42));

  -- Validate existence/liveness AFTER acquiring the locks.
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

  -- Completeness guard: every DECLARED FK to player_profiles(id) must be handled
  -- below. (Polymorphic refs have no FK and are handled explicitly — see
  -- external_links re-point. A future *non*-FK person ref must be added there.)
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

  -- carry the user link to the winner if only the loser had one (keeps admin
  -- memberships valid when moved onto the winner)
  IF w_user IS NULL AND l_user IS NOT NULL THEN
    UPDATE player_profiles SET user_id = l_user WHERE id = p_winner;
  END IF;

  -- carry loser-only profile data onto a sparse winner (don't lose the richer record)
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

  -- external_links: polymorphic person ref (entity_id is a globally-unique uuid;
  -- no FK, so the guard can't see it). Dedupe against UNIQUE(source_id,entity_type,entity_id).
  DELETE FROM external_links l WHERE l.entity_id = p_loser
    AND EXISTS (SELECT 1 FROM external_links w WHERE w.entity_id = p_winner
                AND w.source_id = l.source_id AND w.entity_type = l.entity_type);
  UPDATE external_links SET entity_id = p_winner WHERE entity_id = p_loser;

  UPDATE users SET primary_person_id = p_winner WHERE primary_person_id = p_loser;

  UPDATE player_profiles SET merged_into_id = p_winner, updated_at = now() WHERE id = p_loser;
END $$;

-- Destructive / privileged: only the trusted server (service_role) may call.
-- Must REVOKE FROM PUBLIC (the default grant anon/authenticated inherit) — a
-- plain REVOKE FROM anon leaves the PUBLIC grant intact and is a no-op.
REVOKE EXECUTE ON FUNCTION public.merge_persons(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_membership(text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.role_rank(public.organization_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_persons(uuid, uuid) TO service_role;
