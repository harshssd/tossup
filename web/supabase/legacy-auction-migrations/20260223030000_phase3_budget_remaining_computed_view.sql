-- Phase 3: Replace denormalized budget_remaining with computed view
-- P2: teams.budget_remaining is fragile (non-atomic update in /sold endpoint)
-- Both API endpoints already compute the real value from auction_results anyway.

-- Create a view for computed budget
CREATE VIEW team_budgets AS
SELECT
  t.id AS team_id,
  t.auction_id,
  a.budget_per_team AS total_budget,
  COALESCE(SUM(ar.winning_bid_amount), 0)::integer AS spent,
  (a.budget_per_team - COALESCE(SUM(ar.winning_bid_amount), 0))::integer AS budget_remaining
FROM teams t
JOIN auctions a ON t.auction_id = a.id
LEFT JOIN auction_results ar ON ar.team_id = t.id AND ar.auction_id = t.auction_id
GROUP BY t.id, t.auction_id, a.budget_per_team;

-- Drop the column
ALTER TABLE teams DROP COLUMN IF EXISTS budget_remaining;
