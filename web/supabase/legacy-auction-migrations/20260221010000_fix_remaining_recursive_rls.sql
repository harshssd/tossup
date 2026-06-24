-- Fix remaining infinite recursion in RLS policies.
--
-- The clubs "Club members can view their club" policy queries club_memberships directly,
-- and the club_memberships policy queries clubs back, creating infinite recursion.
-- Same pattern exists for leagues/league_memberships.
--
-- Fix: use the SECURITY DEFINER helper functions (created in 0002) that bypass RLS.

-- Also create helper functions for owner checks to break the other direction of recursion.
CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = p_club_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_owner(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = p_league_id AND owner_id = auth.uid()
  );
$$;

-- Fix clubs: "Club members can view their club"
-- Old: EXISTS (SELECT 1 FROM club_memberships WHERE ...) — triggers club_memberships RLS → clubs RLS → recursion
-- New: is_club_member(id) — SECURITY DEFINER bypasses RLS
DROP POLICY IF EXISTS "Club members can view their club" ON public.clubs;
CREATE POLICY "Club members can view their club" ON public.clubs
FOR SELECT USING (
    public.is_club_member(id)
);

-- Fix leagues: "League members can view their league"
-- Same pattern as clubs
DROP POLICY IF EXISTS "League members can view their league" ON public.leagues;
CREATE POLICY "League members can view their league" ON public.leagues
FOR SELECT USING (
    public.is_league_member(id)
);

-- Fix leagues: "Club members can view club leagues"
-- Old: queries club_memberships and clubs directly — same recursion
-- New: uses SECURITY DEFINER functions
DROP POLICY IF EXISTS "Club members can view club leagues" ON public.leagues;
CREATE POLICY "Club members can view club leagues" ON public.leagues
FOR SELECT USING (
    club_id IS NULL
    OR public.is_club_member(club_id)
    OR public.is_club_owner(club_id)
);

-- Fix club_memberships: "Club owners can manage memberships" (ALL policy)
-- Old: EXISTS (SELECT 1 FROM clubs WHERE ...) — triggers clubs RLS → club_memberships RLS → recursion
DROP POLICY IF EXISTS "Club owners can manage memberships" ON public.club_memberships;
CREATE POLICY "Club owners can manage memberships" ON public.club_memberships
FOR ALL USING (public.is_club_owner(club_id));

-- Fix club_memberships: replace the clubs subquery with is_club_owner
DROP POLICY IF EXISTS "Members can view memberships in their club" ON public.club_memberships;
CREATE POLICY "Members can view memberships in their club" ON public.club_memberships
FOR SELECT USING (
    public.is_club_member(club_id)
    OR public.is_club_owner(club_id)
);

-- Fix league_memberships: "League owners can manage memberships" (ALL policy)
DROP POLICY IF EXISTS "League owners can manage memberships" ON public.league_memberships;
CREATE POLICY "League owners can manage memberships" ON public.league_memberships
FOR ALL USING (public.is_league_owner(league_id));

-- Fix league_memberships: replace the leagues subquery with is_league_owner
DROP POLICY IF EXISTS "Members can view memberships in their league" ON public.league_memberships;
CREATE POLICY "Members can view memberships in their league" ON public.league_memberships
FOR SELECT USING (
    public.is_league_member(league_id)
    OR public.is_league_owner(league_id)
);
