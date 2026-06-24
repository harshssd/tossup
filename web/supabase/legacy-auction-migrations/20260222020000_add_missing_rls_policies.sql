-- Add missing RLS policies for auction_results and auction_participations.
-- These tables had RLS enabled in 0001_initial_schema.sql but no policies were ever created,
-- causing queries that join/embed these tables to fail silently or return empty results.
--
-- IMPORTANT: The auctions table has a "Private auctions viewable by participants" policy
-- that queries auction_participations. If auction_participations policies query auctions
-- directly, PostgreSQL detects infinite recursion. We use SECURITY DEFINER helper functions
-- to bypass RLS on the inner auction check, breaking the cycle.
-- (Same pattern as 0002_fix_recursive_rls_policies.sql for clubs/leagues.)

-- ═══════════════════════════════════════════════════════════════════
-- SECURITY DEFINER helpers (bypass RLS to break recursion)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_auction_owner(p_auction_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auctions
    WHERE id = p_auction_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_auction_visible(p_auction_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auctions
    WHERE id = p_auction_id
    AND (visibility = 'PUBLIC' OR owner_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_auction_public(p_auction_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auctions
    WHERE id = p_auction_id AND visibility = 'PUBLIC'
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- auction_results policies
-- ═══════════════════════════════════════════════════════════════════

-- SELECT: viewable for public auctions or by auction owner
CREATE POLICY "Auction results viewable by participants" ON public.auction_results
FOR SELECT USING (public.is_auction_visible(auction_id));

-- ALL: auction owners can fully manage results
CREATE POLICY "Auction owners can manage results" ON public.auction_results
FOR ALL USING (public.is_auction_owner(auction_id))
WITH CHECK (public.is_auction_owner(auction_id));

-- ═══════════════════════════════════════════════════════════════════
-- auction_participations policies
-- ═══════════════════════════════════════════════════════════════════

-- SELECT: users can always see their own participations
CREATE POLICY "Users can view own participations" ON public.auction_participations
FOR SELECT USING (user_id = auth.uid());

-- ALL: auction owners can fully manage participations
CREATE POLICY "Auction owners can manage participations" ON public.auction_participations
FOR ALL USING (public.is_auction_owner(auction_id))
WITH CHECK (public.is_auction_owner(auction_id));

-- SELECT: participations viewable for public auctions
CREATE POLICY "Participations viewable for public auctions" ON public.auction_participations
FOR SELECT USING (public.is_auction_public(auction_id));
