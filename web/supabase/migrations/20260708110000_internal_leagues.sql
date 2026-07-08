-- Phase C3: internal (club-scoped) leagues. A club-scoped tournament is already
-- possible via leagues.club_id — this makes it safe, first-class, and governed by
-- the club (not just the one admin who created it).
--
-- (1) Constrain leagues.club_id on write. Previously leagues_owner_insert only
--     checked owner_id = auth.uid(), so any signed-in user could create a league
--     (PUBLIC) with club_id = <victim club> and it would surface on that club's
--     public page under "Tournaments". Same for re-pointing club_id via update.
--     Now a league may only claim a club the writer administers.
-- (2) Club admins govern their club's leagues. Without this, only the league's
--     creator (its owner) could manage/delete/conclude it — a club could not
--     govern its own internal league, a departed admin would retain sole control,
--     and co-admins would hit a dead-end. Extending is_scope_admin('league') to
--     admins of the league's club_id fixes all of that in one place (it flows
--     through every league-gated policy: read, write, delete, conclude, pavilion).
--     Honor safety is preserved: internal leagues are PRIVATE and conclude mints
--     TOSSUP_VERIFIED honors for PUBLIC leagues only, and even then each winning
--     club's honor still requires that club's own consented approved registration
--     (independent of who runs the conclude), so this opens no cross-club forge.
-- (3) Let every admin of a club read that club's leagues on the manage page.

DROP POLICY IF EXISTS "leagues_owner_insert" ON public.leagues;
CREATE POLICY "leagues_owner_insert" ON public.leagues
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (club_id IS NULL OR public.is_scope_admin(auth.uid(), 'club', club_id))
  );

DROP POLICY IF EXISTS "leagues_admin_update" ON public.leagues;
CREATE POLICY "leagues_admin_update" ON public.leagues
  FOR UPDATE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', id))
  WITH CHECK (
    public.is_scope_admin(auth.uid(), 'league', id)
    AND (club_id IS NULL OR public.is_scope_admin(auth.uid(), 'club', club_id))
  );

DROP POLICY IF EXISTS "leagues_club_admin_read" ON public.leagues;
CREATE POLICY "leagues_club_admin_read" ON public.leagues
  FOR SELECT TO authenticated
  USING (club_id IS NOT NULL AND public.is_scope_admin(auth.uid(), 'club', club_id));

-- A club admin administers that club's leagues. Recurses into the 'club' branch
-- (depth 1 — the club branch never recurses). All other branches unchanged.
CREATE OR REPLACE FUNCTION public.is_scope_admin(p_user UUID, p_scope TEXT, p_scope_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ok BOOLEAN := FALSE;
BEGIN
  IF p_user IS NULL OR p_scope_id IS NULL THEN RETURN FALSE; END IF;
  IF p_scope = 'club' THEN
    SELECT EXISTS(SELECT 1 FROM clubs c WHERE c.id = p_scope_id AND c.owner_id = p_user)
        OR EXISTS(SELECT 1 FROM club_memberships m JOIN player_profiles pp ON pp.id = m.person_id
                  WHERE m.club_id = p_scope_id AND pp.user_id = p_user AND m.role IN ('OWNER','ADMIN')) INTO ok;
  ELSIF p_scope = 'league' THEN
    SELECT EXISTS(SELECT 1 FROM leagues l WHERE l.id = p_scope_id AND l.owner_id = p_user)
        OR EXISTS(SELECT 1 FROM league_memberships m JOIN player_profiles pp ON pp.id = m.person_id
                  WHERE m.league_id = p_scope_id AND pp.user_id = p_user AND m.role IN ('OWNER','ADMIN'))
        OR EXISTS(SELECT 1 FROM leagues l WHERE l.id = p_scope_id AND l.club_id IS NOT NULL
                  AND public.is_scope_admin(p_user, 'club', l.club_id)) INTO ok;
  ELSIF p_scope = 'team' THEN
    SELECT EXISTS(SELECT 1 FROM team_memberships m JOIN player_profiles pp ON pp.id = m.person_id
                  WHERE m.team_id = p_scope_id AND pp.user_id = p_user AND m.role IN ('OWNER','ADMIN')) INTO ok;
  ELSIF p_scope = 'tournament_team' THEN
    SELECT EXISTS(SELECT 1 FROM tournament_team_memberships m JOIN player_profiles pp ON pp.id = m.person_id
                  WHERE m.tournament_team_id = p_scope_id AND pp.user_id = p_user AND m.role IN ('OWNER','ADMIN')) INTO ok;
  END IF;
  RETURN COALESCE(ok, FALSE);
END $$;

-- Remediate any pre-existing squatter rows: a club-scoped league whose owner is
-- not (and never became) an admin of that club is a stale/forged claim. Detach
-- it (club_id = NULL) so it stops surfacing on the club and isn't frozen by the
-- new update WITH CHECK. No-op on the current near-greenfield DB (0 rows).
UPDATE public.leagues l
   SET club_id = NULL
 WHERE l.club_id IS NOT NULL
   AND NOT public.is_scope_admin(l.owner_id, 'club', l.club_id);
