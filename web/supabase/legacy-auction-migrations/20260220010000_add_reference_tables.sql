-- Reference tables for cricket data
-- These were previously created in seed.sql but need to be in a migration
-- so that batch execution works correctly.

-- Tier color presets
CREATE TABLE IF NOT EXISTS public.tier_color_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT
);

-- Team color presets
CREATE TABLE IF NOT EXISTS public.team_color_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    primary_color TEXT NOT NULL,
    secondary_color TEXT NOT NULL,
    description TEXT
);

-- Cricket position reference data
CREATE TABLE IF NOT EXISTS public.cricket_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role playing_role NOT NULL,
    display_name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    description TEXT
);

-- Batting style reference
CREATE TABLE IF NOT EXISTS public.batting_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT
);

-- Bowling style reference
CREATE TABLE IF NOT EXISTS public.bowling_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT
);

-- RLS policies - readable by all authenticated users
ALTER TABLE public.tier_color_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_color_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cricket_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batting_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bowling_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reference data readable by all" ON public.tier_color_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reference data readable by all" ON public.team_color_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reference data readable by all" ON public.cricket_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reference data readable by all" ON public.batting_styles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reference data readable by all" ON public.bowling_styles FOR SELECT TO authenticated USING (true);
