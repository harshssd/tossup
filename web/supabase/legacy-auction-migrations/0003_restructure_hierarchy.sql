-- Migration: Restructure Hierarchy
-- Remove Club→Auction link, Add Club→League link
-- Hierarchy: Club → League → Auction (clubs organize leagues, leagues run auctions)

-- Step 1: Add club_id to leagues table
ALTER TABLE public.leagues
ADD COLUMN club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

-- Step 2: Add index on leagues(club_id)
CREATE INDEX idx_leagues_club ON public.leagues(club_id);

-- Step 3: Add RLS policy for club members to view leagues in their club
CREATE POLICY "Club members can view club leagues"
ON public.leagues FOR SELECT
USING (
    club_id IS NULL
    OR EXISTS (
        SELECT 1 FROM public.club_memberships cm
        WHERE cm.club_id = leagues.club_id AND cm.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = leagues.club_id AND c.owner_id = auth.uid()
    )
);

-- Step 4: Drop auction→club foreign key, index, and column
ALTER TABLE public.auctions
DROP CONSTRAINT IF EXISTS fk_auctions_club;

DROP INDEX IF EXISTS idx_auctions_club;

ALTER TABLE public.auctions
DROP COLUMN IF EXISTS club_id;
