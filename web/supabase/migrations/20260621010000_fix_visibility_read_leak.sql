-- Security fix: clubs/leagues/player_profiles had BOTH a *_public_read SELECT
-- policy (visibility='PUBLIC') AND a permissive FOR ALL USING(true) policy.
-- Postgres OR-combines permissive policies, so USING(true) also covered SELECT
-- and leaked PRIVATE rows to anon. Make the permissive policies write-only;
-- the *_public_read policy is now the sole governor of SELECT.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clubs','leagues','player_profiles'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "practice_anon_all" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "platform_anon_all" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_ins" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_upd" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_del" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "anon_write_ins" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "anon_write_upd" ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "anon_write_del" ON public.%I FOR DELETE TO anon, authenticated USING (true);', t);
  END LOOP;
END $$;
