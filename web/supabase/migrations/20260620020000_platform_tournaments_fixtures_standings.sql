-- Platform consolidation B: tournaments, teams, fixtures, structured results, auto-standings.
CREATE TABLE IF NOT EXISTS public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, code TEXT UNIQUE,
  type TEXT NOT NULL DEFAULT 'TOURNAMENT' CHECK (type IN ('TOURNAMENT','LEAGUE','SEASONAL','CHAMPIONSHIP')),
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL, owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  visibility public.visibility NOT NULL DEFAULT 'PUBLIC', season TEXT, start_date DATE, end_date DATE, max_teams INTEGER,
  registration_url TEXT, registration_status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (registration_status IN ('OPEN','CLOSED','UPCOMING')),
  rules_text TEXT, format TEXT, venue TEXT, location TEXT, city TEXT, region TEXT, country TEXT,
  latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, contact_info JSONB NOT NULL DEFAULT '{}'::jsonb, social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  recognition_tier public.recognition_tier NOT NULL DEFAULT 'COMMUNITY', verified_at TIMESTAMPTZ, verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verification_source TEXT, reputation_score NUMERIC NOT NULL DEFAULT 0,
  points_win INTEGER NOT NULL DEFAULT 2, points_tie INTEGER NOT NULL DEFAULT 1, points_loss INTEGER NOT NULL DEFAULT 0, points_noresult INTEGER NOT NULL DEFAULT 1,
  standings JSONB NOT NULL DEFAULT '[]'::jsonb, settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leagues_geo ON public.leagues(country, region, city);
CREATE INDEX IF NOT EXISTS idx_leagues_club ON public.leagues(club_id);

CREATE TABLE IF NOT EXISTS public.league_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, role public.organization_role NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (league_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL, club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL, captain_name TEXT, contact_email TEXT,
  contact_phone TEXT, logo TEXT, color TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (league_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_league ON public.tournament_teams(league_id);

CREATE TABLE IF NOT EXISTS public.tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL, club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL, contact_name TEXT, contact_email TEXT,
  contact_phone TEXT, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  notes TEXT, user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_league ON public.tournament_registrations(league_id);

CREATE TABLE IF NOT EXISTS public.fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  match_number INTEGER, round_label TEXT, team_a_id UUID REFERENCES public.tournament_teams(id) ON DELETE SET NULL,
  team_b_id UUID REFERENCES public.tournament_teams(id) ON DELETE SET NULL, team_a_name TEXT, team_b_name TEXT, venue TEXT,
  scheduled_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','LIVE','COMPLETED','ABANDONED')),
  team_a_runs INTEGER, team_a_wickets INTEGER, team_a_overs NUMERIC, team_b_runs INTEGER, team_b_wickets INTEGER, team_b_overs NUMERIC,
  result_type TEXT CHECK (result_type IN ('WIN','TIE','NO_RESULT','ABANDONED')), winner_team_id UUID REFERENCES public.tournament_teams(id) ON DELETE SET NULL,
  result_note TEXT, external_source TEXT, external_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fixtures_league ON public.fixtures(league_id);

CREATE OR REPLACE VIEW public.tournament_standings WITH (security_invoker = on) AS
WITH results AS (
  SELECT f.league_id, f.team_a_id AS team_id,
    CASE WHEN f.result_type='WIN' AND f.winner_team_id=f.team_a_id THEN 'W' WHEN f.result_type='WIN' AND f.winner_team_id=f.team_b_id THEN 'L'
         WHEN f.result_type='TIE' THEN 'T' WHEN f.result_type='NO_RESULT' THEN 'NR' END AS outcome, f.team_a_runs AS runs_for, f.team_b_runs AS runs_against
  FROM public.fixtures f WHERE f.status='COMPLETED' AND f.team_a_id IS NOT NULL
  UNION ALL
  SELECT f.league_id, f.team_b_id,
    CASE WHEN f.result_type='WIN' AND f.winner_team_id=f.team_b_id THEN 'W' WHEN f.result_type='WIN' AND f.winner_team_id=f.team_a_id THEN 'L'
         WHEN f.result_type='TIE' THEN 'T' WHEN f.result_type='NO_RESULT' THEN 'NR' END, f.team_b_runs, f.team_a_runs
  FROM public.fixtures f WHERE f.status='COMPLETED' AND f.team_b_id IS NOT NULL
)
SELECT t.league_id, t.id AS team_id, t.name, COUNT(r.outcome) AS played,
  COUNT(*) FILTER (WHERE r.outcome='W') AS won, COUNT(*) FILTER (WHERE r.outcome='L') AS lost,
  COUNT(*) FILTER (WHERE r.outcome='T') AS tied, COUNT(*) FILTER (WHERE r.outcome='NR') AS no_result,
  COALESCE(SUM(r.runs_for),0) AS runs_for, COALESCE(SUM(r.runs_against),0) AS runs_against,
  (COUNT(*) FILTER (WHERE r.outcome='W')*l.points_win + COUNT(*) FILTER (WHERE r.outcome='T')*l.points_tie
   + COUNT(*) FILTER (WHERE r.outcome='L')*l.points_loss + COUNT(*) FILTER (WHERE r.outcome='NR')*l.points_noresult) AS points
FROM public.tournament_teams t JOIN public.leagues l ON l.id=t.league_id LEFT JOIN results r ON r.team_id=t.id
GROUP BY t.league_id, t.id, t.name, l.points_win, l.points_tie, l.points_loss, l.points_noresult;

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leagues_public_read" ON public.leagues;
CREATE POLICY "leagues_public_read" ON public.leagues FOR SELECT TO anon, authenticated USING (visibility='PUBLIC' OR visibility IS NULL);
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['leagues','league_memberships','tournament_teams','tournament_registrations','fixtures'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS "platform_anon_all" ON public.%I;', t);
  EXECUTE format('CREATE POLICY "platform_anon_all" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t);
END LOOP; END $$;
