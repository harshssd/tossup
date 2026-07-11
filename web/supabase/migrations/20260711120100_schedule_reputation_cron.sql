-- Phase D4 — schedule the nightly reputation recompute via pg_cron.
-- Separated from the scoring logic so the function can be iterated without
-- touching the schedule. Runs daily at 03:15 UTC (quiet hours across US metros).
-- Idempotent: unschedules any existing job of the same name before re-adding.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('recompute-reputation')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recompute-reputation');

SELECT cron.schedule('recompute-reputation', '15 3 * * *', $$SELECT public.recompute_reputation();$$);
