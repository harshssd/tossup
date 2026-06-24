-- Phase 2: Remove dead tables/columns, fix bid queries

-- P3: Drop team_players table (0 rows, squad tracked by auction_results)
DROP TABLE IF EXISTS team_players;

-- P4: Drop bids.captain_id column and its index
-- First replace the RLS policy that references captain_id
DROP POLICY IF EXISTS "Captains can manage own bids" ON bids;

-- New policy: team captains can manage bids for their team
CREATE POLICY "Team captains can manage bids" ON bids
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = bids.team_id
    AND (
      t.captain_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM auction_participations ap
        WHERE ap.team_id = t.id AND ap.user_id = auth.uid()
        AND ap.role IN ('OWNER', 'MODERATOR', 'CAPTAIN')
      )
    )
  )
);

-- Now safe to drop the column and index
DROP INDEX IF EXISTS idx_bids_captain;
ALTER TABLE bids DROP COLUMN IF EXISTS captain_id;
