-- Phase 4: Consolidate to single source of truth
-- Drop System B tables/columns, add queue_state for auction queue config

-- Add queue_state JSONB column for queue order (this is config, not derived data)
ALTER TABLE auctions ADD COLUMN queue_state JSONB;

-- Drop the runtime_state column (third copy of state)
ALTER TABLE auctions DROP COLUMN IF EXISTS runtime_state;

-- Drop auction_bids table (text-keyed, no FKs, disconnected from relational model)
DROP TABLE IF EXISTS auction_bids;

-- Drop live_auctions table (JSON blob state, replaced by formal model + Realtime)
DROP TABLE IF EXISTS live_auctions;

-- Re-create the realtime publication for the formal model tables
-- (live_auctions and auction_bids were in the old publication)
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE rounds, bids, auction_results, teams, auctions;
