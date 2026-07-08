-- Phase D2: club join requests. A signed-in user asks to join a PUBLIC club; a
-- club admin approves (→ MEMBER membership for the requester's Person) or rejects.
-- Complements the Phase-5 cmem_self_join RLS with an admin-vetted path — the
-- default "Request to join" UX on the platform club page.

CREATE TABLE IF NOT EXISTS public.club_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,     -- the requester (auth user)
  message text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one PENDING request per (club, user); a decided one can be re-requested.
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_join_pending
  ON public.club_join_requests (club_id, user_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_club_join_club_status ON public.club_join_requests (club_id, status);
-- Serves getViewerJoinState: latest request for (club, viewer) across all statuses.
CREATE INDEX IF NOT EXISTS idx_club_join_user ON public.club_join_requests (club_id, user_id, created_at DESC);

ALTER TABLE public.club_join_requests ENABLE ROW LEVEL SECURITY;

-- Reads: requester sees own; club admins see their club's.
DROP POLICY IF EXISTS cjr_self_read ON public.club_join_requests;
DROP POLICY IF EXISTS cjr_admin_read ON public.club_join_requests;
DROP POLICY IF EXISTS cjr_self_insert ON public.club_join_requests;
DROP POLICY IF EXISTS cjr_self_delete ON public.club_join_requests;
DROP POLICY IF EXISTS cjr_admin_delete ON public.club_join_requests;
CREATE POLICY cjr_self_read ON public.club_join_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cjr_admin_read ON public.club_join_requests
  FOR SELECT TO authenticated USING (is_scope_admin(auth.uid(), 'club', club_id));

-- Insert: your own PENDING request to a PUBLIC club you're not already in.
CREATE POLICY cjr_self_insert ON public.club_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'PENDING'
    AND decided_by IS NULL AND decided_at IS NULL
    AND (message IS NULL OR char_length(message) <= 1000)
    AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_id AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.club_memberships m
      JOIN public.player_profiles pp ON pp.id = m.person_id
      WHERE m.club_id = club_join_requests.club_id AND pp.user_id = auth.uid()
    )
  );

-- Requester withdraws own PENDING; admins can clear their club's requests.
CREATE POLICY cjr_self_delete ON public.club_join_requests
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND status = 'PENDING');
CREATE POLICY cjr_admin_delete ON public.club_join_requests
  FOR DELETE TO authenticated USING (is_scope_admin(auth.uid(), 'club', club_id));

-- No UPDATE policy: approve/reject flows only through decide_club_join_request.

-- Decide a request: admin-only, atomic, idempotent membership create.
CREATE OR REPLACE FUNCTION public.decide_club_join_request(p_request_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  r public.club_join_requests%ROWTYPE;
  v_person uuid;
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
  ELSE
    UPDATE public.club_join_requests
      SET status = 'REJECTED', decided_by = auth.uid(), decided_at = now(), updated_at = now()
      WHERE id = p_request_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decide_club_join_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_club_join_request(uuid, boolean) TO authenticated;

-- Admin-gated reader: pending requests with the requester's display name resolved
-- (definer, so it doesn't depend on users/player_profiles read RLS). Returns only
-- name + message + timestamp — never the requester's email or contact fields.
CREATE OR REPLACE FUNCTION public.list_club_join_requests(p_club_id uuid)
RETURNS TABLE (id uuid, user_id uuid, requester_name text, message text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_scope_admin(auth.uid(), 'club', p_club_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT r.id, r.user_id,
           COALESCE(pp.display_name, u.name, 'Player') AS requester_name,
           r.message, r.created_at
    FROM public.club_join_requests r
    JOIN public.users u ON u.id = r.user_id
    LEFT JOIN public.player_profiles pp ON pp.id = u.primary_person_id
    WHERE r.club_id = p_club_id AND r.status = 'PENDING'
      -- Hide requests from users who are already members (e.g. self-joined via
      -- cmem_self_join), so a stale request doesn't sit in the approve queue.
      AND NOT EXISTS (
        SELECT 1 FROM public.club_memberships m
        JOIN public.player_profiles mp ON mp.id = m.person_id
        WHERE m.club_id = r.club_id AND mp.user_id = r.user_id
      )
    ORDER BY r.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_club_join_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_club_join_requests(uuid) TO authenticated;
