-- Phase F: follows digest. A weekly in-app digest for each user who follows
-- clubs/tournaments — "N upcoming events, N results, N announcements from the
-- clubs and tournaments you follow" — surfaced in the existing bell + inbox and
-- linking to /home. Built on the F2 notifications stack; email delivery can later
-- read these DIGEST rows (or reuse send_follows_digest's assembly) via SMTP.

-- New notification kind (the value is only referenced inside the function body,
-- which is parsed at call time, so this is safe in one migration).
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'DIGEST';

-- Weekly digest producer. For each follower, count last-7-days activity across
-- their followed PUBLIC scopes; skip users with nothing new; dedup so a user gets
-- at most one digest per ~week even if the job runs more than once. Job-only.
CREATE OR REPLACE FUNCTION public.send_follows_digest()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_sent int := 0;
  r record;
  v_events int;
  v_results int;
  v_ann int;
  v_parts text[];
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.follows LOOP
    -- Dedup: at most one digest per user per ~week.
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.user_id AND n.kind = 'DIGEST'
        AND n.created_at > now() - interval '6 days'
    ) THEN
      CONTINUE;
    END IF;

    WITH fc AS (
      SELECT f.scope_id FROM public.follows f
      JOIN public.clubs c ON c.id = f.scope_id
      WHERE f.user_id = r.user_id AND f.scope = 'club'
        AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)
    ), fl AS (
      SELECT f.scope_id FROM public.follows f
      JOIN public.leagues l ON l.id = f.scope_id
      WHERE f.user_id = r.user_id AND f.scope = 'league'
        AND (l.visibility = 'PUBLIC' OR l.visibility IS NULL)
    )
    SELECT
      (SELECT count(*) FROM public.club_events e
         WHERE e.club_id IN (SELECT scope_id FROM fc)
           AND e.starts_at > now() AND e.starts_at <= now() + interval '7 days'),
      (SELECT count(*) FROM public.fixtures fx
         WHERE fx.league_id IN (SELECT scope_id FROM fl)
           AND fx.status = 'COMPLETED' AND fx.updated_at >= now() - interval '7 days'),
      (SELECT count(*) FROM public.tournament_posts p
         WHERE p.kind IN ('ANNOUNCEMENT', 'SCHEDULE', 'RESULT', 'ALERT')
           AND p.created_at >= now() - interval '7 days'
           AND (p.expires_at IS NULL OR p.expires_at > now())
           AND (p.club_id IN (SELECT scope_id FROM fc) OR p.league_id IN (SELECT scope_id FROM fl)))
    INTO v_events, v_results, v_ann;

    IF COALESCE(v_events, 0) + COALESCE(v_results, 0) + COALESCE(v_ann, 0) = 0 THEN
      CONTINUE;
    END IF;

    v_parts := ARRAY[]::text[];
    IF v_events > 0 THEN
      v_parts := v_parts || (v_events || ' upcoming event' || CASE WHEN v_events = 1 THEN '' ELSE 's' END);
    END IF;
    IF v_results > 0 THEN
      v_parts := v_parts || (v_results || ' result' || CASE WHEN v_results = 1 THEN '' ELSE 's' END);
    END IF;
    IF v_ann > 0 THEN
      v_parts := v_parts || (v_ann || ' announcement' || CASE WHEN v_ann = 1 THEN '' ELSE 's' END);
    END IF;

    PERFORM public.notify(
      r.user_id, 'DIGEST',
      'Your weekly cricket digest',
      array_to_string(v_parts, ', ') || ' from the clubs and tournaments you follow.',
      '/home',
      jsonb_build_object('events', v_events, 'results', v_results, 'announcements', v_ann)
    );
    v_sent := v_sent + 1;
  END LOOP;
  RETURN v_sent;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_follows_digest() FROM PUBLIC, anon, authenticated;

-- Weekly, Monday 14:00 UTC. Guarded so a local db reset without pg_cron won't abort.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-follows-digest') THEN
    PERFORM cron.unschedule('send-follows-digest');
  END IF;
  PERFORM cron.schedule('send-follows-digest', '0 14 * * 1', 'SELECT public.send_follows_digest();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable; skipping send-follows-digest schedule (%).', SQLERRM;
END $$;
