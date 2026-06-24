-- Add captain_player_id to teams table
-- Allows assigning any player from the auction pool as captain (not just registered users)

ALTER TABLE public.teams
ADD COLUMN captain_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL;

-- Add index for captain player lookups
CREATE INDEX idx_teams_captain_player ON public.teams(captain_player_id);
