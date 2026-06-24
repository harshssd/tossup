-- Add missing RLS policies for rounds and fix bids policy.
-- Required for session-based client access (no service_role key dependency).

-- ── Rounds policies ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read rounds" ON public.rounds;
CREATE POLICY "Anyone can read rounds" ON public.rounds
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auction owners can create rounds" ON public.rounds;
CREATE POLICY "Auction owners can create rounds" ON public.rounds
  FOR INSERT WITH CHECK (
    auction_id IN (SELECT id FROM public.auctions WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Auction owners can update rounds" ON public.rounds;
CREATE POLICY "Auction owners can update rounds" ON public.rounds
  FOR UPDATE USING (
    auction_id IN (SELECT id FROM public.auctions WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Auction owners can delete rounds" ON public.rounds;
CREATE POLICY "Auction owners can delete rounds" ON public.rounds
  FOR DELETE USING (
    auction_id IN (SELECT id FROM public.auctions WHERE owner_id = auth.uid())
  );

-- ── Bids policy: expand to include auction owners ────────────────────
-- The original policy only checked team-level participation (ap.team_id = t.id)
-- but auction owners have auction-level participation (team_id IS NULL).
-- Add direct auction owner check so owners can manage bids for any team.
DROP POLICY IF EXISTS "Team captains can manage bids" ON public.bids;
CREATE POLICY "Team captains can manage bids" ON public.bids
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = bids.team_id
      AND (
        t.captain_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.auction_participations ap
          WHERE ap.team_id = t.id
          AND ap.user_id = auth.uid()
          AND ap.role = ANY (ARRAY['OWNER'::participant_role, 'MODERATOR'::participant_role, 'CAPTAIN'::participant_role])
        )
        OR EXISTS (
          SELECT 1 FROM public.auctions a
          WHERE a.id = t.auction_id
          AND a.owner_id = auth.uid()
        )
      )
    )
  );
