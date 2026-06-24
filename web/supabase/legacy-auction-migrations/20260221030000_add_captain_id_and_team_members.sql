-- Add captain_id to teams and create team_members table
-- Fixes: "Could not find a relationship between 'teams' and 'users'"

-- Step 1: Add captain_id column to teams
ALTER TABLE public.teams
ADD COLUMN captain_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 2: Add index for captain lookups
CREATE INDEX idx_teams_captain ON public.teams(captain_id);

-- Step 3: Create team_members table
CREATE TABLE public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(team_id, user_id)
);

-- Step 4: Add indexes
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);

-- Step 5: Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS policies for team_members
-- Viewable by auction participants (via teams → auctions)
CREATE POLICY "Team members viewable by auction participants" ON public.team_members
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.auctions a ON a.id = t.auction_id
        WHERE t.id = team_members.team_id
        AND (
            a.owner_id = auth.uid()
            OR a.visibility = 'PUBLIC'
            OR EXISTS (
                SELECT 1 FROM public.auction_participations ap
                WHERE ap.auction_id = a.id AND ap.user_id = auth.uid()
            )
        )
    )
);

-- Auction owners can manage team members
CREATE POLICY "Auction owners can manage team members" ON public.team_members
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.auctions a ON a.id = t.auction_id
        WHERE t.id = team_members.team_id AND a.owner_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.auctions a ON a.id = t.auction_id
        WHERE t.id = team_members.team_id AND a.owner_id = auth.uid()
    )
);
