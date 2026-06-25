-- Tighten player_profiles writes — the last wide-open anon write surface.
--
-- Until now anyone (anon) could create / edit / delete ANY Person, and
-- persons.ts link/unlink ran unguarded. The only client write path is
-- /player/new (createPlayerProfile); signup self-Person (handle_new_user),
-- admin roster add (add_club_member), person merge (merge_persons), and
-- ingestion all run via SECURITY DEFINER / service_role and bypass these
-- policies — so this only constrains direct client writes.
--
-- Model: a Person is created by and editable by its owning user. Account-less
-- roster identities are created only through add_club_member (admin, definer);
-- they're not client-editable (no owner) until linked via merge.

DROP POLICY IF EXISTS "anon_write_ins" ON public.player_profiles;
DROP POLICY IF EXISTS "anon_write_upd" ON public.player_profiles;
DROP POLICY IF EXISTS "anon_write_del" ON public.player_profiles;

-- create: signed-in users only, and only a Person linked to themselves.
CREATE POLICY "pp_self_insert" ON public.player_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- edit / delete: only the owner. (block_unlink_with_admin_role + the
-- WITH CHECK below also stop an owner from orphaning a Person by nulling user_id.)
CREATE POLICY "pp_owner_update" ON public.player_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "pp_owner_delete" ON public.player_profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- read: PUBLIC (existing player_profiles_public_read) + a signed-in owner sees
-- their own Persons even when not PUBLIC.
CREATE POLICY "pp_owner_read" ON public.player_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
