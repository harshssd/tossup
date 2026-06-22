-- Platform consolidation C: player discovery profiles + external ingestion (CricHeroes-first).
CREATE TABLE IF NOT EXISTS public.player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL, photo TEXT, city TEXT, region TEXT, country TEXT, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
  primary_role TEXT CHECK (primary_role IN ('BATSMAN','BOWLER','ALL_ROUNDER','WICKETKEEPER')), batting_style TEXT, bowling_style TEXT,
  looking_for_club BOOLEAN NOT NULL DEFAULT FALSE, availability TEXT, bio TEXT, contact_email TEXT, contact_phone TEXT,
  current_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL, visibility public.visibility NOT NULL DEFAULT 'PUBLIC',
  recognition_tier public.recognition_tier NOT NULL DEFAULT 'COMMUNITY', reputation_score NUMERIC NOT NULL DEFAULT 0,
  external_links JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_player_profiles_geo ON public.player_profiles(country, region, city);
CREATE INDEX IF NOT EXISTS idx_player_profiles_looking ON public.player_profiles(looking_for_club) WHERE looking_for_club;
CREATE INDEX IF NOT EXISTS idx_player_profiles_role ON public.player_profiles(primary_role);

CREATE TABLE IF NOT EXISTS public.external_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'SCORING_APP' CHECK (type IN ('SCORING_APP','LEAGUE_PLATFORM','EDITORIAL','OFFICIAL')),
  base_url TEXT, default_tier public.recognition_tier NOT NULL DEFAULT 'COMMUNITY', trusted BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), source_id UUID NOT NULL REFERENCES public.external_sources(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('CLUB','LEAGUE','TEAM','PLAYER','FIXTURE')), entity_id UUID NOT NULL,
  external_id TEXT, external_url TEXT, raw JSONB, last_synced_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_external_links_entity ON public.external_links(entity_type, entity_id);
CREATE TABLE IF NOT EXISTS public.ingested_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), source_id UUID NOT NULL REFERENCES public.external_sources(id) ON DELETE CASCADE,
  external_id TEXT, payload JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','MAPPED','REJECTED')),
  mapped_fixture_id UUID REFERENCES public.fixtures(id) ON DELETE SET NULL, fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (source_id, external_id)
);
INSERT INTO public.external_sources (key, name, type, base_url, default_tier, trusted)
VALUES ('cricheroes','CricHeroes','SCORING_APP','https://cricheroes.com','COMMUNITY', false) ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingested_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "player_profiles_public_read" ON public.player_profiles;
CREATE POLICY "player_profiles_public_read" ON public.player_profiles FOR SELECT TO anon, authenticated USING (visibility='PUBLIC' OR visibility IS NULL);
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['player_profiles','external_sources','external_links','ingested_results'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS "platform_anon_all" ON public.%I;', t);
  EXECUTE format('CREATE POLICY "platform_anon_all" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t);
END LOOP; END $$;
