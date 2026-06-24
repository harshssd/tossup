-- Add missing RLS policies for teams and tiers tables
-- Fix: auction owners could not insert teams/tiers when creating an auction

-- Auction owners can INSERT/UPDATE/DELETE teams in their auctions
CREATE POLICY "Auction owners can manage teams" ON public.teams
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.auctions
        WHERE id = teams.auction_id AND owner_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.auctions
        WHERE id = teams.auction_id AND owner_id = auth.uid()
    )
);

-- Auction owners can INSERT/UPDATE/DELETE tiers in their auctions
CREATE POLICY "Auction owners can manage tiers" ON public.tiers
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.auctions
        WHERE id = tiers.auction_id AND owner_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.auctions
        WHERE id = tiers.auction_id AND owner_id = auth.uid()
    )
);

-- Tiers viewable by auction participants and public auction viewers
CREATE POLICY "Tiers viewable by auction participants" ON public.tiers
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.auction_participations
        WHERE auction_id = tiers.auction_id AND user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.auctions
        WHERE id = tiers.auction_id AND (visibility = 'PUBLIC' OR owner_id = auth.uid())
    )
);
