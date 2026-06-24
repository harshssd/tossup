-- 1. Add user_id to players
ALTER TABLE public.players
ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX idx_players_user ON public.players(user_id);

-- 2. Create join table
CREATE TABLE public.team_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, player_id)
);
CREATE INDEX idx_team_players_team ON public.team_players(team_id);
CREATE INDEX idx_team_players_player ON public.team_players(player_id);

-- 3. RLS
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team players viewable by auction participants" ON public.team_players
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.auctions a ON a.id = t.auction_id
        WHERE t.id = team_players.team_id
        AND (a.owner_id = auth.uid() OR a.visibility = 'PUBLIC'
             OR EXISTS (SELECT 1 FROM public.auction_participations ap
                        WHERE ap.auction_id = a.id AND ap.user_id = auth.uid()))
    )
);

CREATE POLICY "Auction owners can manage team players" ON public.team_players
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.auctions a ON a.id = t.auction_id
        WHERE t.id = team_players.team_id AND a.owner_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.auctions a ON a.id = t.auction_id
        WHERE t.id = team_players.team_id AND a.owner_id = auth.uid()
    )
);

-- 4. Migrate existing data
INSERT INTO public.team_players (team_id, player_id)
SELECT assigned_team_id, id FROM public.players WHERE assigned_team_id IS NOT NULL;

-- 5. Drop old column and index
DROP INDEX IF EXISTS idx_players_team;
ALTER TABLE public.players DROP COLUMN assigned_team_id;
