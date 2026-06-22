-- Clubs + teams layer for the practice tracker micro-app.
-- A club owns a roster of players, organized into teams; players move freely
-- across teams (or sit in the unassigned "practice pool"). Sessions belong to a club.
CREATE TABLE IF NOT EXISTS public.clubs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.practice_teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.practice_players  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;
ALTER TABLE public.practice_players  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.practice_teams(id) ON DELETE SET NULL;
ALTER TABLE public.practice_sessions ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_practice_players_club  ON public.practice_players(club_id);
CREATE INDEX IF NOT EXISTS idx_practice_players_team  ON public.practice_players(team_id);
CREATE INDEX IF NOT EXISTS idx_practice_teams_club    ON public.practice_teams(club_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_club ON public.practice_sessions(club_id);

DROP VIEW IF EXISTS public.practice_player_stats;
CREATE VIEW public.practice_player_stats AS
SELECT
    p.id AS player_id, p.name, p.club_id, p.team_id, p.is_batsman, p.is_bowler, p.is_regular_bowler,
    COUNT(DISTINCT a.session_id) FILTER (WHERE a.present) AS sessions_attended,
    COALESCE(SUM(b.runs), 0) AS total_runs,
    COALESCE(SUM(b.balls_faced), 0) AS total_balls,
    COALESCE(SUM(b.fours), 0) AS total_fours,
    COALESCE(SUM(b.sixes), 0) AS total_sixes,
    COALESCE(SUM(b.dismissals), 0) AS total_dismissals,
    COALESCE(SUM(b.net_score), 0) AS total_net,
    COALESCE(MAX(b.net_score), 0) AS best_net,
    CASE WHEN COALESCE(SUM(b.balls_faced),0) > 0
         THEN ROUND(100.0 * SUM(b.runs) / SUM(b.balls_faced), 1) ELSE 0 END AS strike_rate,
    COALESCE(SUM(w.wickets), 0) AS total_wickets,
    COALESCE(SUM(w.balls_bowled), 0) AS total_balls_bowled,
    COALESCE(SUM(w.runs_conceded), 0) AS total_runs_conceded
FROM public.practice_players p
LEFT JOIN public.practice_attendance a ON a.player_id = p.id
LEFT JOIN public.practice_batting   b ON b.player_id = p.id
LEFT JOIN public.practice_bowling   w ON w.player_id = p.id
GROUP BY p.id, p.name, p.club_id, p.team_id, p.is_batsman, p.is_bowler, p.is_regular_bowler;

ALTER TABLE public.clubs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_teams ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['clubs','practice_teams'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "practice_anon_all" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "practice_anon_all" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;
