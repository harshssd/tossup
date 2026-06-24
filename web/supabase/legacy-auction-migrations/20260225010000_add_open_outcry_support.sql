-- Migration: Add Open Outcry Bidding Support
-- Adds a second bidding mode (IPL-style open outcry) alongside existing sealed tender

-- 1. Bidding type enum + column on auctions
DO $$ BEGIN
  CREATE TYPE bidding_type AS ENUM ('SEALED_TENDER', 'OPEN_OUTCRY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bidding_type bidding_type NOT NULL DEFAULT 'SEALED_TENDER';

-- 2. Open outcry config (increment rules + timer) stored as JSONB
-- Example: { "rules": [{ "from_multiplier": 1, "to_multiplier": 2, "increment": 10 }, ...], "timer_seconds": 15 }
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS outcry_config JSONB;

-- 3. Sequence number on bids (NULL = sealed tender, integer = outcry paddle raise)
ALTER TABLE bids ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

-- 4. Round-level state for open outcry
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS current_bid_amount INTEGER;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS current_bid_team_id UUID REFERENCES teams(id);
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS base_price INTEGER;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS bid_count INTEGER DEFAULT 0;

-- 5. Relax unique constraint for outcry (multiple bids per team per round)
-- Drop the old unique constraint that allows only one bid per team per round
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_round_id_team_id_player_id_key;

-- Sealed-tender: one bid per team per round (sequence_number IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS bids_sealed_unique
  ON bids (round_id, team_id, player_id) WHERE sequence_number IS NULL;

-- Open-outcry: unique on round + sequence
CREATE UNIQUE INDEX IF NOT EXISTS bids_outcry_unique
  ON bids (round_id, sequence_number) WHERE sequence_number IS NOT NULL;

-- 6. Performance indexes
CREATE INDEX IF NOT EXISTS idx_bids_round_sequence
  ON bids (round_id, sequence_number DESC NULLS LAST);

-- 7. Atomic paddle raise function for open outcry
CREATE OR REPLACE FUNCTION raise_paddle(
  p_round_id UUID,
  p_team_id UUID,
  p_player_id UUID,
  p_auction_id UUID,
  p_timer_seconds INTEGER DEFAULT NULL
) RETURNS TABLE(new_amount INTEGER, new_sequence INTEGER, bid_id UUID)
LANGUAGE plpgsql AS $$
DECLARE
  v_round RECORD;
  v_auction RECORD;
  v_config JSONB;
  v_current_amount INTEGER;
  v_base_price INTEGER;
  v_increment INTEGER;
  v_new_amount INTEGER;
  v_new_sequence INTEGER;
  v_bid_id UUID;
  v_rule RECORD;
  v_multiplier NUMERIC;
BEGIN
  -- Lock round row to prevent concurrent updates
  SELECT r.id, r.current_bid_amount, r.base_price, r.bid_count, r.current_bid_team_id, r.status
  INTO v_round
  FROM rounds r
  WHERE r.id = p_round_id
  FOR UPDATE;

  IF v_round IS NULL THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  IF v_round.status != 'OPEN' THEN
    RAISE EXCEPTION 'Round is not open for bidding';
  END IF;

  -- Cannot raise if your team already holds the highest bid
  IF v_round.current_bid_team_id = p_team_id THEN
    RAISE EXCEPTION 'Your team already holds the highest bid';
  END IF;

  -- Get auction outcry config
  SELECT a.outcry_config
  INTO v_config
  FROM auctions a
  WHERE a.id = p_auction_id;

  v_current_amount := COALESCE(v_round.current_bid_amount, v_round.base_price);
  v_base_price := COALESCE(v_round.base_price, 0);

  -- Calculate increment from outcry_config rules
  -- Rules are: [{ from_multiplier, to_multiplier, increment }]
  -- multiplier = current_amount / base_price
  v_increment := v_base_price; -- default increment = base price (fallback)

  IF v_config IS NOT NULL AND v_config->'rules' IS NOT NULL AND v_base_price > 0 THEN
    v_multiplier := v_current_amount::NUMERIC / v_base_price::NUMERIC;

    FOR v_rule IN
      SELECT
        (rule->>'from_multiplier')::NUMERIC AS from_mul,
        (rule->>'to_multiplier')::NUMERIC AS to_mul,
        (rule->>'increment')::INTEGER AS incr
      FROM jsonb_array_elements(v_config->'rules') AS rule
    LOOP
      IF v_multiplier >= v_rule.from_mul AND v_multiplier < v_rule.to_mul THEN
        v_increment := v_rule.incr;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- For the very first bid (bid_count = 0), the new amount IS the base price (no increment)
  IF v_round.bid_count = 0 THEN
    v_new_amount := v_base_price;
  ELSE
    v_new_amount := v_current_amount + v_increment;
  END IF;

  v_new_sequence := COALESCE(v_round.bid_count, 0) + 1;

  -- Insert new bid
  INSERT INTO bids (round_id, team_id, player_id, amount, submitted_at, sequence_number)
  VALUES (p_round_id, p_team_id, p_player_id, v_new_amount, NOW(), v_new_sequence)
  RETURNING id INTO v_bid_id;

  -- Update round state
  UPDATE rounds
  SET
    current_bid_amount = v_new_amount,
    current_bid_team_id = p_team_id,
    bid_count = v_new_sequence,
    closed_at = CASE
      WHEN p_timer_seconds IS NOT NULL
      THEN NOW() + (p_timer_seconds || ' seconds')::INTERVAL
      ELSE closed_at
    END
  WHERE id = p_round_id;

  RETURN QUERY SELECT v_new_amount, v_new_sequence, v_bid_id;
END;
$$;
