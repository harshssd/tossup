-- Phase F2: platform notifications. A per-user inbox on the platform project
-- (the legacy /api/notifications stack was on the auction DB and unmounted). v1
-- powers the header bell; producers are SECURITY DEFINER so the system can notify
-- OTHER users (a requester when an admin decides their join request) without
-- letting anyone insert notifications for someone else.

DO $$ BEGIN
  CREATE TYPE public.notification_kind AS ENUM (
    'CLUB_JOIN_APPROVED', 'CLUB_JOIN_REJECTED', 'EVENT_REMINDER', 'GENERIC'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- recipient
  kind public.notification_kind NOT NULL,
  title text NOT NULL,
  body text,
  link text,                                    -- in-app path to open (optional)
  data jsonb NOT NULL DEFAULT '{}'::jsonb,       -- context (e.g. {"club_id": ...})
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bell: newest-first per user; partial index for the unread badge count.
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_self_read ON public.notifications;
DROP POLICY IF EXISTS notif_self_update ON public.notifications;
DROP POLICY IF EXISTS notif_self_delete ON public.notifications;

-- A recipient reads / marks-read / dismisses ONLY their own notifications. There
-- is deliberately NO INSERT policy: nobody can create a notification for anyone
-- (including themselves) via the client — only the SECURITY DEFINER producers
-- below (which run as the function owner) write rows. The self-UPDATE is for
-- read_at; the columns are the recipient's own throwaway inbox data (no trust
-- columns), so a column-guard trigger isn't warranted here.
CREATE POLICY notif_self_read ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_self_update ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_self_delete ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Internal producer: insert a notification for a user. SECURITY DEFINER so it
-- bypasses the no-INSERT-policy; REVOKEd from every client role so it can only be
-- called from other definer producers (which run as the owner) or service_role.
CREATE OR REPLACE FUNCTION public.notify(
  p_user uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, kind, title, body, link, data)
    VALUES (p_user, p_kind, p_title, p_body, p_link, COALESCE(p_data, '{}'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify(uuid, public.notification_kind, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

-- Wire the Phase-D2 producer: notify the requester when an admin decides their
-- club join request. CREATE OR REPLACE preserves all prior logic verbatim and
-- only appends the notify() call in each branch.
CREATE OR REPLACE FUNCTION public.decide_club_join_request(p_request_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  r public.club_join_requests%ROWTYPE;
  v_person uuid;
  v_club_name text;
  v_club_slug text;
BEGIN
  SELECT * INTO r FROM public.club_join_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'join request not found';
  END IF;
  IF NOT public.is_scope_admin(auth.uid(), 'club', r.club_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF r.status <> 'PENDING' THEN
    RAISE EXCEPTION 'request already decided';
  END IF;

  SELECT name, slug INTO v_club_name, v_club_slug FROM public.clubs WHERE id = r.club_id;

  IF p_approve THEN
    SELECT primary_person_id INTO v_person FROM public.users WHERE id = r.user_id;
    IF v_person IS NULL THEN
      RAISE EXCEPTION 'requester has no player profile to add';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.club_memberships WHERE club_id = r.club_id AND person_id = v_person
    ) THEN
      INSERT INTO public.club_memberships (club_id, person_id, role) VALUES (r.club_id, v_person, 'MEMBER');
    END IF;
    UPDATE public.club_join_requests
      SET status = 'APPROVED', decided_by = auth.uid(), decided_at = now(), updated_at = now()
      WHERE id = p_request_id;
    PERFORM public.notify(
      r.user_id, 'CLUB_JOIN_APPROVED',
      'You''re in! ' || COALESCE(v_club_name, 'A club') || ' approved your request',
      NULL,
      '/club/' || COALESCE(v_club_slug, r.club_id::text),
      jsonb_build_object('club_id', r.club_id)
    );
  ELSE
    UPDATE public.club_join_requests
      SET status = 'REJECTED', decided_by = auth.uid(), decided_at = now(), updated_at = now()
      WHERE id = p_request_id;
    PERFORM public.notify(
      r.user_id, 'CLUB_JOIN_REJECTED',
      COALESCE(v_club_name, 'A club') || ' didn''t accept your request this time',
      NULL,
      '/club/' || COALESCE(v_club_slug, r.club_id::text),
      jsonb_build_object('club_id', r.club_id)
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decide_club_join_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_club_join_request(uuid, boolean) TO authenticated;

-- Publish notifications for realtime so the bell's badge updates live. Realtime
-- respects RLS (notif_self_read), so each client only receives its own rows.
-- Guarded: ADD TABLE errors if already a member.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
