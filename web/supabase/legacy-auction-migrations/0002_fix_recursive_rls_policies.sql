-- Fix infinite recursion in club_memberships and league_memberships RLS policies.
-- The original policies query the same table in their USING clause, which triggers
-- the same policy evaluation again, causing infinite recursion.
-- Fix: use SECURITY DEFINER functions that bypass RLS for the inner membership check.

-- Helper function: check if the current user is a member of a club (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = p_club_id AND user_id = auth.uid()
  );
$$;

-- Helper function: check if the current user is a member of a league (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_league_member(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_memberships
    WHERE league_id = p_league_id AND user_id = auth.uid()
  );
$$;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can view memberships in their club" ON public.club_memberships;
DROP POLICY IF EXISTS "Members can view memberships in their league" ON public.league_memberships;

-- Recreate with non-recursive versions using the SECURITY DEFINER functions
CREATE POLICY "Members can view memberships in their club" ON public.club_memberships
FOR SELECT USING (
    public.is_club_member(club_id) OR
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = club_memberships.club_id AND owner_id = auth.uid()
    )
);

CREATE POLICY "Members can view memberships in their league" ON public.league_memberships
FOR SELECT USING (
    public.is_league_member(league_id) OR
    EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = league_memberships.league_id AND owner_id = auth.uid()
    )
);
