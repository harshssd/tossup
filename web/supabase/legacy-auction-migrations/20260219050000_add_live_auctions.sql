-- Create live_auctions table for real-time auction state
CREATE TABLE IF NOT EXISTS live_auctions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state JSONB NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create auction_bids table for captain bids
CREATE TABLE IF NOT EXISTS auction_bids (
  id SERIAL PRIMARY KEY,
  auction_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  player_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auction_id, team_name) -- One bid per team
);

-- Enable real-time for both tables
ALTER TABLE live_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;

-- Create policies for live_auctions
CREATE POLICY "Anyone can read live auctions" ON live_auctions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert/update live auctions" ON live_auctions
  FOR ALL USING (true);

-- Create policies for auction_bids
CREATE POLICY "Anyone can read auction bids" ON auction_bids
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert/update auction bids" ON auction_bids
  FOR ALL USING (true);

-- Enable real-time subscriptions
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE live_auctions, auction_bids;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_auctions_id ON live_auctions(id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_id ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_team ON auction_bids(auction_id, team_name);