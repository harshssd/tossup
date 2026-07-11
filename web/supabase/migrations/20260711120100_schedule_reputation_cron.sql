-- Phase D4 — schedule the nightly reputation recompute via pg_cron.
-- Separated from the scoring logic so the function can be iterated without
-- touching the schedule. Runs daily at 03:15 UTC (quiet hours across US metros).
--
-- Wrapped in an exception-guarded block: pg_cron must be in the postgres image's
-- shared_preload_libraries, which is true on Supabase (prod) and current CLI
-- images, but NOT guaranteed on every contributor's local stack. If it can't be
-- loaded, this no-ops with a NOTICE instead of aborting `supabase db reset`.
-- Idempotent: unschedules any existing job of the same name before re-adding.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recompute-reputation') THEN
    PERFORM cron.unschedule('recompute-reputation');
  END IF;

  PERFORM cron.schedule('recompute-reputation', '15 3 * * *', 'SELECT public.recompute_reputation();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable — skipping reputation schedule (schedule it manually in prod): %', SQLERRM;
END $$;
