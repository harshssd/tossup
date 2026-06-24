-- Add missing RLS policies for players table
-- Fix: RLS was enabled but no policies existed, blocking all operations

-- Auction owners can INSERT/UPDATE/DELETE players in their auctions
CREATE POLICY "Auction owners can manage players" ON public.players
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.auctions
        WHERE id = players.auction_id AND owner_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.auctions
        WHERE id = players.auction_id AND owner_id = auth.uid()
    )
);

-- Players viewable by auction participants and public auction viewers
CREATE POLICY "Players viewable by auction participants" ON public.players
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.auction_participations
        WHERE auction_id = players.auction_id AND user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.auctions
        WHERE id = players.auction_id AND (visibility = 'PUBLIC' OR owner_id = auth.uid())
    )
);
