-- Phase F2.x: event-reminder producer. A nightly-ish job that sends an
-- EVENT_REMINDER notification to members who RSVP'd GOING/MAYBE for a club event
-- starting within the next 48h. Builds on the Phase-F2 notifications stack.

-- Per-(event, user) dedup so a member is reminded once even though the job runs
-- repeatedly (and so a late RSVP still gets a reminder on a later run). Internal
-- bookkeeping only: RLS on with NO policies (default-deny to every client); the
-- SECURITY DEFINER producer bypasses it.
CREATE TABLE IF NOT EXISTS public.event_reminders_sent (
  event_id uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE public.event_reminders_sent ENABLE ROW LEVEL SECURITY;

-- Supports the producer's standalone starts_at range scan (the existing
-- (club_id, starts_at) index can't serve a club_id-less window).
CREATE INDEX IF NOT EXISTS club_events_starts_idx ON public.club_events (starts_at);

-- Producer: notify each GOING/MAYBE RSVP for events starting in (now, now+48h]
-- that hasn't already been reminded. Idempotent via event_reminders_sent.
-- Returns how many reminders were sent (for observability / manual runs).
CREATE OR REPLACE FUNCTION public.send_event_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count int := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT e.id AS event_id, e.club_id, e.title, e.starts_at,
           c.slug AS club_slug, c.name AS club_name, ev.user_id
    FROM public.club_events e
    JOIN public.clubs c ON c.id = e.club_id
    JOIN public.event_rsvps ev ON ev.event_id = e.id AND ev.status IN ('GOING', 'MAYBE')
    WHERE e.starts_at > now()
      AND e.starts_at <= now() + interval '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.event_reminders_sent s
        WHERE s.event_id = e.id AND s.user_id = ev.user_id
      )
  LOOP
    -- Claim the (event, user) first; if a concurrent run already claimed it, skip
    -- so we can't double-send.
    INSERT INTO public.event_reminders_sent (event_id, user_id)
      VALUES (rec.event_id, rec.user_id)
      ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    -- No date/time in the body: starts_at is timestamptz and we have no per-club
    -- timezone, so a server-side (UTC) date would be off-by-a-day for far-region
    -- members. The reminder only fires within 48h ("starting soon"), and the link
    -- opens the club page which renders the exact time in the viewer's locale.
    PERFORM public.notify(
      rec.user_id, 'EVENT_REMINDER',
      'Reminder: ' || rec.title,
      COALESCE(rec.club_name, 'Your club') || ' · starting soon',
      CASE WHEN rec.club_slug IS NOT NULL THEN '/club/' || rec.club_slug END,
      jsonb_build_object('event_id', rec.event_id, 'club_id', rec.club_id)
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Producer is job/service-role only — never a client RPC.
REVOKE EXECUTE ON FUNCTION public.send_event_reminders() FROM PUBLIC, anon, authenticated;

-- Schedule hourly so a last-minute event (created/RSVP'd shortly before it starts)
-- isn't missed between coarse ticks; the per-(event,user) dedup makes extra ticks
-- free (no repeat sends). Guarded so a local `db reset` (no pg_cron) doesn't abort.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-event-reminders') THEN
    PERFORM cron.unschedule('send-event-reminders');
  END IF;
  PERFORM cron.schedule('send-event-reminders', '0 * * * *', 'SELECT public.send_event_reminders();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable; skipping send-event-reminders schedule (%).', SQLERRM;
END $$;
