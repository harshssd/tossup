-- Phase C1/C2: club events + RSVP on the platform DB (events were previously
-- stranded on the legacy auction project). Powers practice sessions, matches,
-- and socials — the "new in town, find a game" funnel and the club's own life.

DO $$ BEGIN CREATE TYPE public.event_type AS ENUM ('PRACTICE','MATCH','SOCIAL','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.rsvp_status AS ENUM ('GOING','MAYBE','NOT_GOING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.club_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_type public.event_type NOT NULL DEFAULT 'PRACTICE',
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_events_ends_after_start CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX club_events_club_starts_idx ON public.club_events (club_id, starts_at);

CREATE TABLE public.event_rsvps (
  event_id uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
-- PK leads on event_id; index user_id for the self-RLS policies + "my RSVPs".
CREATE INDEX event_rsvps_user_idx ON public.event_rsvps (user_id);

-- Any-role club membership check (is_scope_admin only covers OWNER/ADMIN). Used
-- by RLS so a PRIVATE club's members can see + RSVP to their own events.
CREATE OR REPLACE FUNCTION public.is_club_member(p_user uuid, p_club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user IS NOT NULL AND p_club IS NOT NULL AND EXISTS (
    SELECT 1 FROM club_memberships m JOIN player_profiles pp ON pp.id = m.person_id
    WHERE m.club_id = p_club AND pp.user_id = p_user
  );
$$;
-- Only authenticated RLS predicates call this; keep anon from probing it as a
-- membership oracle. Supabase grants EXECUTE to anon directly (not only via
-- PUBLIC), so revoke from both. RLS still evaluates it (policies run as the
-- authenticated caller, which keeps EXECUTE).
REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO authenticated;

ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- club_events: public read for PUBLIC clubs; admins + members read their own
-- (incl. PRIVATE); admins write.
CREATE POLICY "cevt_public_read" ON public.club_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_id AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)
  ));
CREATE POLICY "cevt_member_read" ON public.club_events
  FOR SELECT TO authenticated
  USING (is_scope_admin(auth.uid(), 'club', club_id) OR is_club_member(auth.uid(), club_id));
CREATE POLICY "cevt_admin_insert" ON public.club_events
  FOR INSERT TO authenticated
  WITH CHECK (is_scope_admin(auth.uid(), 'club', club_id) AND created_by = auth.uid());
CREATE POLICY "cevt_admin_update" ON public.club_events
  FOR UPDATE TO authenticated
  USING (is_scope_admin(auth.uid(), 'club', club_id))
  WITH CHECK (is_scope_admin(auth.uid(), 'club', club_id));
CREATE POLICY "cevt_admin_delete" ON public.club_events
  FOR DELETE TO authenticated
  USING (is_scope_admin(auth.uid(), 'club', club_id));

-- event_rsvps: a user manages only their own RSVP, and may RSVP only to an event
-- they can see (public event, or a club they admin/belong to). Club admins +
-- members can read the attendee list of events they can see.
CREATE POLICY "ersvp_self_select" ON public.event_rsvps
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ersvp_member_select" ON public.event_rsvps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.club_events e
    WHERE e.id = event_id
      AND (is_scope_admin(auth.uid(), 'club', e.club_id) OR is_club_member(auth.uid(), e.club_id))
  ));
-- "If you can see the event, you can RSVP to it": the EXISTS is evaluated under
-- the caller's club_events RLS (cevt_public_read / cevt_member_read), so it's
-- true exactly for public events + events of a club the caller admins/belongs
-- to. Avoids joining clubs directly (a member can't read a PRIVATE club row).
CREATE POLICY "ersvp_self_insert" ON public.event_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.club_events e WHERE e.id = event_id)
  );
CREATE POLICY "ersvp_self_update" ON public.event_rsvps
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ersvp_self_delete" ON public.event_rsvps
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Public engagement counts for PUBLIC-club events, without exposing who RSVP'd.
-- security_invoker=false (definer): bypasses event_rsvps RLS but the join to
-- clubs scopes output to PUBLIC clubs only, so no private data leaks and only
-- aggregate counts (never user ids) are returned. Anon-readable.
CREATE VIEW public.club_event_rsvp_counts
WITH (security_invoker = false) AS
SELECT e.id AS event_id,
       count(*) FILTER (WHERE r.status = 'GOING')::int AS going,
       count(*) FILTER (WHERE r.status = 'MAYBE')::int AS maybe
FROM public.club_events e
JOIN public.clubs c ON c.id = e.club_id AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)
LEFT JOIN public.event_rsvps r ON r.event_id = e.id
GROUP BY e.id;
GRANT SELECT ON public.club_event_rsvp_counts TO anon, authenticated;
