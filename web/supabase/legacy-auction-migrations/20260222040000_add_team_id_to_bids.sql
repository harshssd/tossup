-- Add team_id to bids so bids are attributed to teams (not just captains)
-- This supports team-based bidding where captain_id may not be set
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.bids ALTER COLUMN captain_id DROP NOT NULL;

-- Replace unique constraint: one bid per team per round per player
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_round_id_captain_id_player_id_key;
ALTER TABLE public.bids ADD CONSTRAINT bids_round_id_team_id_player_id_key UNIQUE (round_id, team_id, player_id);

CREATE INDEX IF NOT EXISTS idx_bids_team ON public.bids(team_id);
