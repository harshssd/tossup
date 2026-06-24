-- Phase 5 (club roster): real club ownership + admin-scoped roster writes.
--
-- Mirrors the Phase 4 tournament lockdown for the club scope. Until now clubs and
-- club_memberships had wide-open writes; the roster admin UI gates the DB, not
-- just the screen. is_scope_admin('club') = clubs.owner_id OR an OWNER/ADMIN
-- club_membership. Bootstrap: createOwnedClub sets owner_id before the OWNER
-- membership, so is_scope_admin is already true via owner_id.
--
-- player_profiles RLS is intentionally left as-is (broader pre-auth surface used
-- by /player/new + ingestion); roster member creation goes through the
-- SECURITY DEFINER add_club_member() below instead of relying on it.

-- ---------- clubs ----------
DROP POLICY IF EXISTS "anon_write_ins" ON public.clubs;
DROP POLICY IF EXISTS "anon_write_upd" ON public.clubs;
DROP POLICY IF EXISTS "anon_write_del" ON public.clubs;
CREATE POLICY "clubs_owner_insert" ON public.clubs
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "clubs_admin_update" ON public.clubs
  FOR UPDATE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'club', id))
  WITH CHECK (public.is_scope_admin(auth.uid(), 'club', id));
CREATE POLICY "clubs_admin_delete" ON public.clubs
  FOR DELETE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'club', id));
CREATE POLICY "clubs_admin_read" ON public.clubs
  FOR SELECT TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'club', id));
-- clubs_public_read (SELECT visibility=PUBLIC) unchanged.

-- ---------- club_memberships ----------
DROP POLICY IF EXISTS "auth_write_ins" ON public.club_memberships;
DROP POLICY IF EXISTS "auth_write_upd" ON public.club_memberships;
DROP POLICY IF EXISTS "auth_write_del" ON public.club_memberships;
-- admins manage the roster (any role)
CREATE POLICY "cmem_admin_insert" ON public.club_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_scope_admin(auth.uid(), 'club', club_id));
-- a signed-in user can self-join a public club as MEMBER, on their own Person
CREATE POLICY "cmem_self_join" ON public.club_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    role = 'MEMBER'
    AND EXISTS (SELECT 1 FROM public.player_profiles pp WHERE pp.id = person_id AND pp.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND (c.visibility = 'PUBLIC' OR c.visibility IS NULL))
  );
CREATE POLICY "cmem_admin_update" ON public.club_memberships
  FOR UPDATE TO authenticated
  USING (public.is_scope_admin(auth.uid(), 'club', club_id))
  WITH CHECK (public.is_scope_admin(auth.uid(), 'club', club_id));
-- admins remove anyone; a member can remove their own membership (leave)
CREATE POLICY "cmem_admin_or_self_delete" ON public.club_memberships
  FOR DELETE TO authenticated
  USING (
    public.is_scope_admin(auth.uid(), 'club', club_id)
    OR EXISTS (SELECT 1 FROM public.player_profiles pp WHERE pp.id = person_id AND pp.user_id = auth.uid())
  );
-- public_read (SELECT) unchanged.

-- ---------- add_club_member (atomic roster add) ----------
-- Creates an account-less Person and a club_membership in one txn. SECURITY
-- DEFINER (writes past player_profiles RLS) but self-checks club-admin authority.
-- ADMIN/OWNER roles on an account-less Person would trip enforce_admin_is_user,
-- so roster adds are limited to MEMBER / MODERATOR (promote later via link).
CREATE OR REPLACE FUNCTION public.add_club_member(p_club_id uuid, p_display_name text, p_role text DEFAULT 'MEMBER')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_person_id uuid; v_role organization_role;
BEGIN
  IF NOT public.is_scope_admin(auth.uid(), 'club', p_club_id) THEN
    RAISE EXCEPTION 'only a club admin can add members';
  END IF;
  IF coalesce(btrim(p_display_name), '') = '' THEN
    RAISE EXCEPTION 'member name is required';
  END IF;
  IF p_role NOT IN ('MEMBER','MODERATOR') THEN
    RAISE EXCEPTION 'roster add supports MEMBER or MODERATOR (link a user first to make an admin)';
  END IF;
  v_role := p_role::organization_role;

  INSERT INTO player_profiles (display_name) VALUES (btrim(p_display_name)) RETURNING id INTO v_person_id;
  INSERT INTO club_memberships (club_id, person_id, role) VALUES (p_club_id, v_person_id, v_role);
  RETURN v_person_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.add_club_member(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_club_member(uuid, text, text) TO authenticated;
