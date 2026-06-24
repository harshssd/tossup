-- CricketBid Initial Schema Migration
-- This migration creates all the tables needed for the cricket auction platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE auction_status AS ENUM ('DRAFT', 'LOBBY', 'LIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE visibility AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE participant_role AS ENUM ('OWNER', 'MODERATOR', 'CAPTAIN', 'VIEWER');
CREATE TYPE playing_role AS ENUM ('BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKETKEEPER');
CREATE TYPE player_status AS ENUM ('AVAILABLE', 'SOLD', 'UNSOLD');
CREATE TYPE round_status AS ENUM ('PENDING', 'OPEN', 'CLOSED');
CREATE TYPE league_type AS ENUM ('TOURNAMENT', 'LEAGUE', 'SEASONAL', 'CHAMPIONSHIP');
CREATE TYPE organization_role AS ENUM ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER');

-- Users table (extends auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    image TEXT,
    phone TEXT,
    bio TEXT,
    organization_name TEXT,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auctions table
CREATE TABLE public.auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    status auction_status NOT NULL DEFAULT 'DRAFT',
    visibility visibility NOT NULL DEFAULT 'PRIVATE',
    passcode TEXT,

    -- Organization associations
    league_id UUID,
    club_id UUID,
    is_standalone BOOLEAN NOT NULL DEFAULT TRUE,

    -- Configuration
    budget_per_team INTEGER NOT NULL DEFAULT 1000,
    currency_name TEXT NOT NULL DEFAULT 'Coins',
    currency_icon TEXT NOT NULL DEFAULT '🪙',
    squad_size INTEGER NOT NULL DEFAULT 11,

    -- Branding
    logo TEXT,
    banner TEXT,
    primary_color TEXT NOT NULL DEFAULT '#1B2A4A',
    secondary_color TEXT NOT NULL DEFAULT '#3B82F6',
    bg_image TEXT,
    font TEXT NOT NULL DEFAULT 'system',
    theme_preset TEXT,
    tagline TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auction participations table
CREATE TABLE public.auction_participations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role participant_role NOT NULL,
    team_id UUID,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(auction_id, user_id)
);

-- Teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    primary_color TEXT NOT NULL DEFAULT '#3B82F6',
    secondary_color TEXT NOT NULL DEFAULT '#1B2A4A',
    logo TEXT,
    budget_remaining INTEGER NOT NULL
);

-- Tiers table
CREATE TABLE public.tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    base_price INTEGER NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    icon TEXT,
    sort_order INTEGER NOT NULL,
    min_per_team INTEGER NOT NULL DEFAULT 0,
    max_per_team INTEGER
);

-- Players table
CREATE TABLE public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    image TEXT,
    playing_role playing_role NOT NULL,
    batting_style TEXT,
    bowling_style TEXT,
    tier_id UUID REFERENCES public.tiers(id) ON DELETE CASCADE NOT NULL,
    custom_tags TEXT,
    status player_status NOT NULL DEFAULT 'AVAILABLE',
    assigned_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL
);

-- Rounds table
CREATE TABLE public.rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
    tier_id UUID REFERENCES public.tiers(id) ON DELETE CASCADE NOT NULL,
    status round_status NOT NULL DEFAULT 'PENDING',
    opened_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    timer_seconds INTEGER
);

-- Bids table
CREATE TABLE public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
    captain_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_winning_bid BOOLEAN NOT NULL DEFAULT FALSE,
    rejection_reason TEXT,

    UNIQUE(round_id, captain_id, player_id)
);

-- Auction results table
CREATE TABLE public.auction_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    winning_bid_amount INTEGER NOT NULL,
    tie_broken BOOLEAN NOT NULL DEFAULT FALSE,
    tie_method TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(auction_id, player_id)
);

-- Dry runs table
CREATE TABLE public.dry_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    config_snapshot JSONB NOT NULL,
    result_snapshot JSONB,
    is_saved BOOLEAN NOT NULL DEFAULT FALSE,
    balance_score REAL,
    recommendations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Audit logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leagues table
CREATE TABLE public.leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    code TEXT UNIQUE NOT NULL,
    type league_type NOT NULL DEFAULT 'TOURNAMENT',
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    logo TEXT,
    banner TEXT,
    primary_color TEXT NOT NULL DEFAULT '#1B2A4A',
    visibility visibility NOT NULL DEFAULT 'PRIVATE',
    season TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    max_teams INTEGER DEFAULT 8,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- League memberships table
CREATE TABLE public.league_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role organization_role NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(league_id, user_id)
);

-- League invites table
CREATE TABLE public.league_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role organization_role NOT NULL DEFAULT 'MEMBER',
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clubs table
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    logo TEXT,
    banner TEXT,
    primary_color TEXT NOT NULL DEFAULT '#1B2A4A',
    visibility visibility NOT NULL DEFAULT 'PRIVATE',
    location TEXT,
    website TEXT,
    max_members INTEGER DEFAULT 50,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Club memberships table
CREATE TABLE public.club_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role organization_role NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(club_id, user_id)
);

-- Club invites table
CREATE TABLE public.club_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role organization_role NOT NULL DEFAULT 'MEMBER',
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for team_id in auction_participations
ALTER TABLE public.auction_participations
ADD CONSTRAINT fk_auction_participations_team
FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- Add foreign keys from auctions to leagues/clubs
ALTER TABLE public.auctions
ADD CONSTRAINT fk_auctions_league
FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE SET NULL;

ALTER TABLE public.auctions
ADD CONSTRAINT fk_auctions_club
FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_auctions_owner ON public.auctions(owner_id);
CREATE INDEX idx_auctions_status ON public.auctions(status);
CREATE INDEX idx_auctions_scheduled ON public.auctions(scheduled_at);
CREATE INDEX idx_auction_participations_auction ON public.auction_participations(auction_id);
CREATE INDEX idx_auction_participations_user ON public.auction_participations(user_id);
CREATE INDEX idx_teams_auction ON public.teams(auction_id);
CREATE INDEX idx_tiers_auction ON public.tiers(auction_id);
CREATE INDEX idx_players_auction ON public.players(auction_id);
CREATE INDEX idx_players_tier ON public.players(tier_id);
CREATE INDEX idx_players_team ON public.players(assigned_team_id);
CREATE INDEX idx_rounds_auction ON public.rounds(auction_id);
CREATE INDEX idx_bids_round ON public.bids(round_id);
CREATE INDEX idx_bids_captain ON public.bids(captain_id);
CREATE INDEX idx_audit_logs_auction ON public.audit_logs(auction_id);
CREATE INDEX idx_auctions_league ON public.auctions(league_id);
CREATE INDEX idx_auctions_club ON public.auctions(club_id);
CREATE INDEX idx_leagues_owner ON public.leagues(owner_id);
CREATE INDEX idx_leagues_code ON public.leagues(code);
CREATE INDEX idx_league_memberships_league ON public.league_memberships(league_id);
CREATE INDEX idx_league_memberships_user ON public.league_memberships(user_id);
CREATE INDEX idx_league_invites_league ON public.league_invites(league_id);
CREATE INDEX idx_league_invites_token ON public.league_invites(token);
CREATE INDEX idx_clubs_owner ON public.clubs(owner_id);
CREATE INDEX idx_clubs_slug ON public.clubs(slug);
CREATE INDEX idx_club_memberships_club ON public.club_memberships(club_id);
CREATE INDEX idx_club_memberships_user ON public.club_memberships(user_id);
CREATE INDEX idx_club_invites_club ON public.club_invites(club_id);
CREATE INDEX idx_club_invites_token ON public.club_invites(token);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dry_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Can only access their own user record
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Auctions: Public auctions viewable by all, private by participants only
CREATE POLICY "Public auctions are viewable by everyone" ON public.auctions
FOR SELECT USING (visibility = 'PUBLIC');

CREATE POLICY "Private auctions viewable by participants" ON public.auctions
FOR SELECT USING (
    visibility = 'PRIVATE' AND (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.auction_participations
            WHERE auction_id = auctions.id AND user_id = auth.uid()
        )
    )
);

CREATE POLICY "Auction owners can manage their auctions" ON public.auctions
FOR ALL USING (owner_id = auth.uid());

-- Teams: Viewable by auction participants
CREATE POLICY "Teams viewable by auction participants" ON public.teams
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.auction_participations
        WHERE auction_id = teams.auction_id AND user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.auctions
        WHERE id = teams.auction_id AND (visibility = 'PUBLIC' OR owner_id = auth.uid())
    )
);

-- Bids: Only captains can see their own bids, owners/moderators can see all
CREATE POLICY "Captains can manage own bids" ON public.bids
FOR ALL USING (captain_id = auth.uid());

CREATE POLICY "Auction owners can view all bids" ON public.bids
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.rounds r
        JOIN public.auctions a ON a.id = r.auction_id
        WHERE r.id = bids.round_id AND a.owner_id = auth.uid()
    )
);

-- Leagues: Owners can do everything, members can read
CREATE POLICY "League owners can manage their leagues" ON public.leagues
FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Public leagues are viewable by authenticated users" ON public.leagues
FOR SELECT USING (visibility = 'PUBLIC' AND auth.uid() IS NOT NULL);

CREATE POLICY "League members can view their league" ON public.leagues
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.league_memberships
        WHERE league_id = leagues.id AND user_id = auth.uid()
    )
);

CREATE POLICY "Authenticated users can insert leagues" ON public.leagues
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- League memberships: Members can read, owners/admins can manage
CREATE POLICY "Members can view memberships in their league" ON public.league_memberships
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.league_memberships lm
        WHERE lm.league_id = league_memberships.league_id AND lm.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = league_memberships.league_id AND owner_id = auth.uid()
    )
);

CREATE POLICY "League owners can manage memberships" ON public.league_memberships
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = league_memberships.league_id AND owner_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their own membership" ON public.league_memberships
FOR INSERT WITH CHECK (user_id = auth.uid());

-- League invites: Owners can manage, recipients can view
CREATE POLICY "League owners can manage invites" ON public.league_invites
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = league_invites.league_id AND owner_id = auth.uid()
    )
);

-- Clubs: Similar policies to leagues
CREATE POLICY "Club owners can manage their clubs" ON public.clubs
FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Public clubs are viewable by authenticated users" ON public.clubs
FOR SELECT USING (visibility = 'PUBLIC' AND auth.uid() IS NOT NULL);

CREATE POLICY "Club members can view their club" ON public.clubs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.club_memberships
        WHERE club_id = clubs.id AND user_id = auth.uid()
    )
);

CREATE POLICY "Authenticated users can insert clubs" ON public.clubs
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Club memberships
CREATE POLICY "Members can view memberships in their club" ON public.club_memberships
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.club_memberships cm
        WHERE cm.club_id = club_memberships.club_id AND cm.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = club_memberships.club_id AND owner_id = auth.uid()
    )
);

CREATE POLICY "Club owners can manage memberships" ON public.club_memberships
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = club_memberships.club_id AND owner_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their own club membership" ON public.club_memberships
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Club invites
CREATE POLICY "Club owners can manage invites" ON public.club_invites
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = club_invites.club_id AND owner_id = auth.uid()
    )
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER handle_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_auctions_updated_at
    BEFORE UPDATE ON public.auctions
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_leagues_updated_at
    BEFORE UPDATE ON public.leagues
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_clubs_updated_at
    BEFORE UPDATE ON public.clubs
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, image)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();