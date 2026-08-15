-- Producers for the new kinds (separate migration: new enum values can't be
-- referenced in the same transaction that adds them).

-- 1) Join request created → notify club admins. SECURITY DEFINER so the trigger
-- (fired by the requester's INSERT) can call the REVOKEd notify() and read the
-- admin graph; recipients are the club owner + user-linked OWNER/ADMIN members.
CREATE OR REPLACE FUNCTION public.notify_join_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_club record;
  v_requester text;
  v_admin uuid;
BEGIN
  SELECT name, slug, owner_id INTO v_club FROM public.clubs WHERE id = NEW.club_id;
  SELECT COALESCE(pp.display_name, u.name, 'A player') INTO v_requester
    FROM public.users u LEFT JOIN public.player_profiles pp ON pp.id = u.primary_person_id
    WHERE u.id = NEW.user_id;

  FOR v_admin IN
    SELECT DISTINCT admin_user FROM (
      SELECT c.owner_id AS admin_user FROM public.clubs c WHERE c.id = NEW.club_id AND c.owner_id IS NOT NULL
      UNION
      SELECT pp.user_id FROM public.club_memberships m
        JOIN public.player_profiles pp ON pp.id = m.person_id
        WHERE m.club_id = NEW.club_id AND m.role IN ('OWNER', 'ADMIN') AND pp.user_id IS NOT NULL
    ) admins
    WHERE admin_user IS DISTINCT FROM NEW.user_id
  LOOP
    PERFORM public.notify(
      v_admin, 'CLUB_JOIN_REQUESTED',
      v_requester || ' asked to join ' || COALESCE(v_club.name, 'your club'),
      NEW.message,
      CASE WHEN v_club.slug IS NOT NULL THEN '/club/' || v_club.slug || '/manage' END,
      jsonb_build_object('club_id', NEW.club_id, 'request_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_join_request ON public.club_join_requests;
CREATE TRIGGER trg_notify_join_request
  AFTER INSERT ON public.club_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_join_request_created();

-- 2+4) Registration decided → notify the registrant; approval also auto-follows
-- the tournament. AFTER UPDATE trigger so BOTH decision paths are covered (the
-- approve definer fn and the client-side reject update).
CREATE OR REPLACE FUNCTION public.notify_registration_decided()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_league record;
BEGIN
  IF NEW.status = OLD.status OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN
    RETURN NEW;
  END IF;
  SELECT name, visibility INTO v_league FROM public.leagues WHERE id = NEW.league_id;

  IF NEW.status = 'APPROVED' THEN
    PERFORM public.notify(
      NEW.user_id, 'REG_APPROVED',
      COALESCE(NEW.team_name, 'Your team') || ' is in! Registration approved for ' || COALESCE(v_league.name, 'the tournament'),
      NULL,
      '/tournaments/' || NEW.league_id,
      jsonb_build_object('league_id', NEW.league_id, 'registration_id', NEW.id)
    );
    -- Auto-follow the tournament so its results/announcements land in the
    -- registrant's /home feed (only PUBLIC scopes are followable — mirror the
    -- follows INSERT policy's visibility gate).
    IF v_league.visibility = 'PUBLIC' OR v_league.visibility IS NULL THEN
      INSERT INTO public.follows (user_id, scope, scope_id)
        VALUES (NEW.user_id, 'league', NEW.league_id)
        ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    PERFORM public.notify(
      NEW.user_id, 'REG_REJECTED',
      COALESCE(v_league.name, 'The tournament') || ' didn''t accept ' || COALESCE(NEW.team_name, 'your team') || ' this time',
      NULL,
      '/tournaments/' || NEW.league_id,
      jsonb_build_object('league_id', NEW.league_id, 'registration_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_registration_decided ON public.tournament_registrations;
CREATE TRIGGER trg_notify_registration_decided
  AFTER UPDATE ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.notify_registration_decided();

-- 3) Join approved → auto-follow the club. CREATE OR REPLACE of the decide
-- function preserving all prior authz/logic verbatim; adds ONLY the follows
-- insert in the approve branch (visibility-gated like the follows policy).
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
  v_club_visibility public.visibility;
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

  SELECT name, slug, visibility INTO v_club_name, v_club_slug, v_club_visibility
    FROM public.clubs WHERE id = r.club_id;

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
    -- New member auto-follows their club (audit U7: joining did NOT follow, so
    -- their own club was invisible in their own feed).
    IF v_club_visibility = 'PUBLIC' OR v_club_visibility IS NULL THEN
      INSERT INTO public.follows (user_id, scope, scope_id)
        VALUES (r.user_id, 'club', r.club_id)
        ON CONFLICT DO NOTHING;
    END IF;
    PERFORM public.notify(
      r.user_id, 'CLUB_JOIN_APPROVED',
      'You''re in! ' || COALESCE(v_club_name, 'A club') || ' approved your request',
      NULL,
      CASE WHEN v_club_slug IS NOT NULL THEN '/club/' || v_club_slug END,
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
      CASE WHEN v_club_slug IS NOT NULL THEN '/club/' || v_club_slug END,
      jsonb_build_object('club_id', r.club_id)
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decide_club_join_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_club_join_request(uuid, boolean) TO authenticated;
