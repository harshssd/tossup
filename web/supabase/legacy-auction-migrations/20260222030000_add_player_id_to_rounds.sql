-- Add player_id to rounds table so each round tracks which player is being auctioned
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES public.players(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_rounds_player ON public.rounds(player_id);
