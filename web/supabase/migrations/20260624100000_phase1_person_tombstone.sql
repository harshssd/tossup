-- Phase 1 (identity model): Person foundation.
-- player_profiles IS the canonical Person. Add the merge tombstone so a Person
-- that gets merged into another (Phase 3) can be redirected and excluded from
-- listings without a hard delete (which would orphan stats/memberships).
--   merged_into_id NULL      => a live Person
--   merged_into_id = <other> => merged away; point readers at <other>

ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.player_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_player_profiles_merged_into ON public.player_profiles(merged_into_id);
