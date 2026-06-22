-- Platform consolidation A: identity, club evolution, recognition, geo.
DO $$ BEGIN CREATE TYPE public.visibility AS ENUM ('PUBLIC','PRIVATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.organization_role AS ENUM ('OWNER','ADMIN','MODERATOR','MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recognition_tier AS ENUM ('OFFICIAL','AFFILIATED','COMMUNITY','UNVERIFIED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, name TEXT, image TEXT, phone TEXT, bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS visibility public.visibility NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS max_members INTEGER;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS recognition_tier public.recognition_tier NOT NULL DEFAULT 'COMMUNITY';
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS verification_source TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS reputation_score NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS reputation_signals JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS is_recruiting BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS roles_needed TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS founded_year INTEGER;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.clubs SET slug = lower(regexp_replace(name,'[^a-zA-Z0-9]+','-','g'))||'-'||left(id::text,6) WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_slug ON public.clubs(slug);
CREATE INDEX IF NOT EXISTS idx_clubs_geo ON public.clubs(country, region, city);
CREATE INDEX IF NOT EXISTS idx_clubs_latlng ON public.clubs(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_clubs_recruiting ON public.clubs(is_recruiting) WHERE is_recruiting;

CREATE TABLE IF NOT EXISTS public.club_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (club_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_club_memberships_club ON public.club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user ON public.club_memberships(user_id);

CREATE OR REPLACE FUNCTION public.km_between(lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $fn$
  SELECT CASE WHEN lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN NULL
    ELSE 6371 * 2 * asin(sqrt(power(sin(radians(lat2-lat1)/2),2) + cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2))) END
$fn$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clubs_public_read" ON public.clubs;
CREATE POLICY "clubs_public_read" ON public.clubs FOR SELECT TO anon, authenticated USING (visibility = 'PUBLIC' OR visibility IS NULL);
DROP POLICY IF EXISTS "practice_anon_all" ON public.club_memberships;
CREATE POLICY "practice_anon_all" ON public.club_memberships FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "users_anon_all" ON public.users;
CREATE POLICY "users_anon_all" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
