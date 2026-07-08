-- Phase C3: internal (club-scoped) leagues. A club-scoped tournament is already
-- possible via leagues.club_id — this makes it safe and first-class.
--
-- (1) Constrain leagues.club_id on write. Previously leagues_owner_insert only
--     checked owner_id = auth.uid(), so any signed-in user could create a league
--     (PUBLIC) with club_id = <victim club> and it would surface on that club's
--     public page under "Tournaments". Same for re-pointing club_id via update.
--     Now a league may only claim a club the writer administers.
-- (2) Let every admin of a club read that club's leagues (incl. PRIVATE internal
--     ones), not just the league's own owner/member — so the club manage page can
--     list them.

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

CREATE POLICY "leagues_club_admin_read" ON public.leagues
  FOR SELECT TO authenticated
  USING (club_id IS NOT NULL AND public.is_scope_admin(auth.uid(), 'club', club_id));
