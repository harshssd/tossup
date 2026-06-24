-- Tournament Schema
-- Extends leagues table for tournament hosting and adds fixtures + registrations

-- Create registration status enum for tournaments
CREATE TYPE registration_status AS ENUM ('OPEN', 'CLOSED', 'UPCOMING');

-- Create team registration status enum
CREATE TYPE team_registration_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Extend leagues table with tournament-specific columns
ALTER TABLE public.leagues ADD COLUMN registration_url TEXT;
ALTER TABLE public.leagues ADD COLUMN rules_text TEXT;
ALTER TABLE public.leagues ADD COLUMN social_links JSONB DEFAULT '{}';
ALTER TABLE public.leagues ADD COLUMN format TEXT;
ALTER TABLE public.leagues ADD COLUMN venue TEXT;
ALTER TABLE public.leagues ADD COLUMN contact_info JSONB DEFAULT '{}';
ALTER TABLE public.leagues ADD COLUMN registration_status registration_status DEFAULT 'UPCOMING';
ALTER TABLE public.leagues ADD COLUMN standings JSONB DEFAULT '[]';

-- Fixtures table (tournament match schedule)
CREATE TABLE public.fixtures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    match_number INTEGER NOT NULL,
    team_a_name TEXT NOT NULL,
    team_b_name TEXT NOT NULL,
    team_a_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    team_b_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    venue TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    result TEXT,
    winner TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament registrations table
CREATE TABLE public.tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    team_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    status team_registration_status NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fixtures_league ON public.fixtures(league_id);
CREATE INDEX idx_fixtures_scheduled_at ON public.fixtures(scheduled_at);
CREATE INDEX idx_tournament_registrations_league ON public.tournament_registrations(league_id);
CREATE INDEX idx_tournament_registrations_user ON public.tournament_registrations(user_id);
CREATE INDEX idx_tournament_registrations_status ON public.tournament_registrations(status);

-- Updated_at trigger for fixtures
CREATE TRIGGER handle_fixtures_updated_at
    BEFORE UPDATE ON public.fixtures
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fixtures

-- Public fixtures are viewable by anyone (for public tournaments)
CREATE POLICY "Fixtures viewable for public tournaments" ON public.fixtures
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = fixtures.league_id AND visibility = 'PUBLIC'
    )
);

-- Private fixtures viewable by league members
CREATE POLICY "Fixtures viewable by league members" ON public.fixtures
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.league_memberships
        WHERE league_id = fixtures.league_id AND user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = fixtures.league_id AND owner_id = auth.uid()
    )
);

-- League owners can manage fixtures
CREATE POLICY "League owners can manage fixtures" ON public.fixtures
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = fixtures.league_id AND owner_id = auth.uid()
    )
);

-- RLS Policies for tournament_registrations

-- Authenticated users can register (insert)
CREATE POLICY "Authenticated users can register for tournaments" ON public.tournament_registrations
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- League owners can view all registrations
CREATE POLICY "League owners can view registrations" ON public.tournament_registrations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = tournament_registrations.league_id AND owner_id = auth.uid()
    )
);

-- Users can view their own registrations
CREATE POLICY "Users can view own registrations" ON public.tournament_registrations
FOR SELECT USING (user_id = auth.uid());

-- League owners can update registrations (approve/reject)
CREATE POLICY "League owners can update registrations" ON public.tournament_registrations
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = tournament_registrations.league_id AND owner_id = auth.uid()
    )
);
