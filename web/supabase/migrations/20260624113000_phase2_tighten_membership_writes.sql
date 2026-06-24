-- Phase 2 hardening (review finding): membership/team writes were open to anon
-- (TO anon WITH CHECK(true)) — an unauthenticated caller could self-grant an
-- OWNER/ADMIN membership (the admin-is-user trigger only requires the *person*
-- be user-linked, not that the caller IS that user). No app code writes these
-- tables yet, so restrict writes to authenticated now — this closes the
-- unauthenticated escalation path at zero cost. Public read stays (Phase 4
-- scopes both reads and writes to is_scope_admin() + the first-admin bootstrap).

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['teams','club_memberships','team_memberships','league_memberships','tournament_team_memberships'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_ins" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_upd" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_del" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "auth_write_ins" ON public.%I FOR INSERT TO authenticated WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "auth_write_upd" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "auth_write_del" ON public.%I FOR DELETE TO authenticated USING (true);', t);
  END LOOP;
END $$;
