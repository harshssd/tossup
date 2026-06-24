-- Phase 4 (tournament scope): enforce host-only writes at the DB layer.
--
-- Until now leagues / tournament_teams / fixtures / tournament_registrations and
-- the membership tables had wide-open anon+authenticated write policies
-- (WITH CHECK true). The tournament-ownership feature gated the UI only — the
-- writes themselves were unprotected. This scopes every tournament write to the
-- tournament's admin via is_scope_admin(), so the manage tools are enforced, not
-- just hidden.
--
-- CRITICAL: league_memberships is included. is_scope_admin('league') returns true
-- for an OWNER/ADMIN league_membership, so leaving membership INSERT open would
-- let any signed-in user self-grant OWNER and bypass every other policy here.
--
-- Bootstrap: createOwnedTournament inserts the league (owner_id = me) BEFORE the
-- OWNER membership, so is_scope_admin is already true (via owner_id) when the
-- membership row is inserted — no chicken-and-egg.
--
-- Reads stay public, gated on the parent league's visibility. Registrations are
-- private (admins + the registrant).
--
-- NOT in scope (separate pass — they don't feed tournament-admin authority and
-- each needs its own bootstrap/self-join design): club_memberships (club join
-- flow), team_memberships / tournament_team_memberships (no owner_id → would
-- deadlock the first admin).

-- ---------- leagues ----------
DROP POLICY IF EXISTS "anon_write_ins" ON public.leagues;
DROP POLICY IF EXISTS "anon_write_upd" ON public.leagues;
DROP POLICY IF EXISTS "anon_write_del" ON public.leagues;
-- create: any signed-in user, but only as owner of the new row
CREATE POLICY "leagues_owner_insert" ON public.leagues
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "leagues_admin_update" ON public.leagues
  FOR UPDATE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', id))
  WITH CHECK (public.is_scope_admin(auth.uid(), 'league', id));
CREATE POLICY "leagues_admin_delete" ON public.leagues
  FOR DELETE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', id));
-- leagues_public_read (SELECT visibility=PUBLIC) is unchanged.

-- ---------- tournament_teams ----------
DROP POLICY IF EXISTS "platform_anon_all" ON public.tournament_teams;
CREATE POLICY "tteams_public_read" ON public.tournament_teams
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.leagues l
                 WHERE l.id = league_id AND (l.visibility = 'PUBLIC' OR l.visibility IS NULL)));
CREATE POLICY "tteams_admin_insert" ON public.tournament_teams
  FOR INSERT TO authenticated
  WITH CHECK (public.is_scope_admin(auth.uid(), 'league', league_id));
CREATE POLICY "tteams_admin_update" ON public.tournament_teams
  FOR UPDATE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id))
  WITH CHECK (public.is_scope_admin(auth.uid(), 'league', league_id));
CREATE POLICY "tteams_admin_delete" ON public.tournament_teams
  FOR DELETE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id));

-- ---------- fixtures ----------
DROP POLICY IF EXISTS "platform_anon_all" ON public.fixtures;
CREATE POLICY "fixtures_public_read" ON public.fixtures
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.leagues l
                 WHERE l.id = league_id AND (l.visibility = 'PUBLIC' OR l.visibility IS NULL)));
CREATE POLICY "fixtures_admin_insert" ON public.fixtures
  FOR INSERT TO authenticated
  WITH CHECK (public.is_scope_admin(auth.uid(), 'league', league_id));
CREATE POLICY "fixtures_admin_update" ON public.fixtures
  FOR UPDATE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id))
  WITH CHECK (public.is_scope_admin(auth.uid(), 'league', league_id));
CREATE POLICY "fixtures_admin_delete" ON public.fixtures
  FOR DELETE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id));

-- ---------- tournament_registrations ----------
DROP POLICY IF EXISTS "platform_anon_all" ON public.tournament_registrations;
-- read: tournament admins see all; a registrant sees their own
CREATE POLICY "treg_admin_or_own_read" ON public.tournament_registrations
  FOR SELECT TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id) OR user_id = auth.uid());
-- create: a signed-in user submits their own PENDING registration (can't self-approve)
CREATE POLICY "treg_self_insert" ON public.tournament_registrations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'PENDING');
-- approve / reject: tournament admins only
CREATE POLICY "treg_admin_update" ON public.tournament_registrations
  FOR UPDATE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id))
  WITH CHECK (public.is_scope_admin(auth.uid(), 'league', league_id));
-- delete: admin, or the registrant withdrawing a still-pending request
CREATE POLICY "treg_admin_or_own_delete" ON public.tournament_registrations
  FOR DELETE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id)
         OR (user_id = auth.uid() AND status = 'PENDING'));

-- ---------- league_memberships (admin authority — must be locked) ----------
DROP POLICY IF EXISTS "auth_write_ins" ON public.league_memberships;
DROP POLICY IF EXISTS "auth_write_upd" ON public.league_memberships;
DROP POLICY IF EXISTS "auth_write_del" ON public.league_memberships;
-- insert/update/delete only by a league admin. Bootstrap holds because the
-- creator is already owner via leagues.owner_id when the first OWNER row lands.
CREATE POLICY "lmem_admin_insert" ON public.league_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_scope_admin(auth.uid(), 'league', league_id));
CREATE POLICY "lmem_admin_update" ON public.league_memberships
  FOR UPDATE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id))
  WITH CHECK (public.is_scope_admin(auth.uid(), 'league', league_id));
CREATE POLICY "lmem_admin_delete" ON public.league_memberships
  FOR DELETE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'league', league_id));
-- league_memberships public_read (SELECT) is unchanged.
