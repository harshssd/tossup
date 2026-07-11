-- Phase E2 — club microsite branding: crest, cover photo, accent colour.
--
-- Columns are non-trust (the D4 clubs guard leaves them alone); club admins write
-- them via the existing clubs_admin_update policy. accent_color is CHECK-validated
-- to a 6-digit hex so only a safe colour ever reaches an inline style.
--
-- Images live in a public Storage bucket 'club-assets' under `{clubId}/...`.
-- Direct client upload is gated by storage RLS: only a club's admin may write
-- objects under that club's id prefix (parsed safely by a definer helper).

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS crest_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS accent_color text;

DO $$
BEGIN
  ALTER TABLE public.clubs
    ADD CONSTRAINT clubs_accent_color_hex CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public bucket with hard size/type caps enforced by Storage itself.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('club-assets', 'club-assets', true, 3145728, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Safe: the object name's first path segment is the club id. Parsing an invalid
-- uuid must not error the policy, so catch it and deny.
CREATE OR REPLACE FUNCTION public.storage_is_club_asset_admin(p_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_club uuid;
BEGIN
  BEGIN
    v_club := split_part(p_name, '/', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN public.is_scope_admin(auth.uid(), 'club', v_club);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.storage_is_club_asset_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_is_club_asset_admin(text) TO authenticated;

-- Storage RLS: anyone reads (public bucket); only the owning club's admins write.
DROP POLICY IF EXISTS club_assets_public_read ON storage.objects;
CREATE POLICY club_assets_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'club-assets');

DROP POLICY IF EXISTS club_assets_admin_insert ON storage.objects;
CREATE POLICY club_assets_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-assets' AND public.storage_is_club_asset_admin(name));

DROP POLICY IF EXISTS club_assets_admin_update ON storage.objects;
CREATE POLICY club_assets_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'club-assets' AND public.storage_is_club_asset_admin(name))
  WITH CHECK (bucket_id = 'club-assets' AND public.storage_is_club_asset_admin(name));

DROP POLICY IF EXISTS club_assets_admin_delete ON storage.objects;
CREATE POLICY club_assets_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'club-assets' AND public.storage_is_club_asset_admin(name));
