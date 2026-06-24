-- Phase 4 addendum: admin read access for non-public tournaments.
--
-- The write-lockdown (20260624130000) gated tournament_teams / fixtures SELECT on
-- the parent league's visibility=PUBLIC, and leagues SELECT was already
-- public-only. That left a gap: a tournament admin could not READ their own
-- tournament's league / teams / fixtures if it were ever PRIVATE (the manage
-- view would render empty). Tournaments default PUBLIC and there's no privacy
-- toggle yet, so this is latent — but the correct model is "an admin can always
-- read their own scope." These OR-combine with the existing public-read
-- policies; they widen nothing for non-admins.

CREATE POLICY "leagues_admin_read" ON public.leagues
  FOR SELECT TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', id));

CREATE POLICY "tteams_admin_read" ON public.tournament_teams
  FOR SELECT TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id));

CREATE POLICY "fixtures_admin_read" ON public.fixtures
  FOR SELECT TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id));
