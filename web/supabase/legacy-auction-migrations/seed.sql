-- CricketBid Seed Data
-- Reference tables are created in migration 20260220010000_add_reference_tables.sql
-- This file only inserts seed data.

-- Tier color presets
INSERT INTO public.tier_color_presets (name, color, description) VALUES
('Platinum', '#E5E4E2', 'Premium tier for top players'),
('Gold', '#FFD700', 'High-value players'),
('Silver', '#C0C0C0', 'Mid-tier players'),
('Bronze', '#CD7F32', 'Entry-level players'),
('Diamond', '#B9F2FF', 'Ultra-premium tier'),
('Elite', '#8B00FF', 'Elite performance tier'),
('Rookie', '#32CD32', 'New/emerging players')
ON CONFLICT DO NOTHING;

-- Cricket position reference data
INSERT INTO public.cricket_positions (role, display_name, abbreviation, description) VALUES
('BATSMAN', 'Batsman', 'BAT', 'Specialist in scoring runs'),
('BOWLER', 'Bowler', 'BWL', 'Specialist in taking wickets'),
('ALL_ROUNDER', 'All-Rounder', 'AR', 'Skilled in both batting and bowling'),
('WICKETKEEPER', 'Wicket-Keeper', 'WK', 'Specialist keeper and batsman')
ON CONFLICT DO NOTHING;

-- Batting style reference
INSERT INTO public.batting_styles (name, description) VALUES
('Right-hand Bat', 'Right-handed batting stance'),
('Left-hand Bat', 'Left-handed batting stance')
ON CONFLICT DO NOTHING;

-- Bowling style reference
INSERT INTO public.bowling_styles (name, description, category) VALUES
('Right-arm Fast', 'Right-arm fast pace bowling', 'Pace'),
('Left-arm Fast', 'Left-arm fast pace bowling', 'Pace'),
('Right-arm Fast-medium', 'Right-arm medium-fast pace', 'Pace'),
('Left-arm Fast-medium', 'Left-arm medium-fast pace', 'Pace'),
('Right-arm Medium', 'Right-arm medium pace bowling', 'Pace'),
('Left-arm Medium', 'Left-arm medium pace bowling', 'Pace'),
('Right-arm Off-break', 'Right-arm off-spin bowling', 'Spin'),
('Left-arm Orthodox', 'Left-arm orthodox spin', 'Spin'),
('Right-arm Leg-break', 'Right-arm leg-spin bowling', 'Spin'),
('Left-arm Chinaman', 'Left-arm unorthodox spin', 'Spin')
ON CONFLICT DO NOTHING;
