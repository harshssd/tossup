-- Admin link: attach an account-less roster Person to an existing user account
-- (by email), keeping it a distinct Person owned by that user. This is the
-- standalone "link a player to a user profile" op (merge_persons is the other —
-- it collapses two Persons into one; this keeps them separate, just sets owner).
--
-- SECURITY DEFINER so it can read the users table (email not exposed to the
-- client) and write past player_profiles RLS, but it self-checks authority:
-- the caller must administer a scope the Person belongs to (same model as merge).
-- Only links an UNLINKED, live Person — re-pointing an already-owned Person is a
-- transfer/merge, not this op.
CREATE OR REPLACE FUNCTION public.link_member_to_user(p_person_id uuid, p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_n int;
BEGIN
  -- Person must exist, be live, and be account-less.
  IF NOT EXISTS (SELECT 1 FROM player_profiles
                 WHERE id = p_person_id AND user_id IS NULL AND merged_into_id IS NULL) THEN
    RAISE EXCEPTION 'person not found, already linked, or merged';
  END IF;

  -- Authority: caller administers a scope the Person belongs to. (Trusted server
  -- with null auth.uid() bypasses.) COALESCE so a non-match always denies.
  IF auth.uid() IS NOT NULL AND NOT COALESCE((
       EXISTS (SELECT 1 FROM club_memberships m WHERE m.person_id = p_person_id
                 AND is_scope_admin(auth.uid(), 'club', m.club_id))
    OR EXISTS (SELECT 1 FROM team_memberships m WHERE m.person_id = p_person_id
                 AND is_scope_admin(auth.uid(), 'team', m.team_id))
    OR EXISTS (SELECT 1 FROM league_memberships m WHERE m.person_id = p_person_id
                 AND is_scope_admin(auth.uid(), 'league', m.league_id))
    OR EXISTS (SELECT 1 FROM tournament_team_memberships m WHERE m.person_id = p_person_id
                 AND is_scope_admin(auth.uid(), 'tournament_team', m.tournament_team_id))
  ), false) THEN
    RAISE EXCEPTION 'not authorized to link this person';
  END IF;

  -- Resolve the target account by email. users.email isn't unique-constrained,
  -- so refuse an ambiguous match rather than linking to an arbitrary account.
  SELECT count(*) INTO v_n FROM users WHERE lower(email) = lower(btrim(p_email));
  IF v_n = 0 THEN
    RAISE EXCEPTION 'no account found for that email';
  ELSIF v_n > 1 THEN
    RAISE EXCEPTION 'multiple accounts share that email — resolve manually';
  END IF;
  SELECT id INTO v_user FROM users WHERE lower(email) = lower(btrim(p_email));

  UPDATE player_profiles SET user_id = v_user, updated_at = now() WHERE id = p_person_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.link_member_to_user(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_member_to_user(uuid, text) TO authenticated;
