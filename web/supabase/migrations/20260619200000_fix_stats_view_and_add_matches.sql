-- Architecture fixes + matches foundation for the practice tracker.

-- 1) Auth-readiness: nullable owner on clubs (no auth wired yet)
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS created_by UUID;

-- 2) Rewrite stats view: aggregate each child separately (the previous single-query
--    multi-join cross-multiplied rows and overcounted once a player had >1 session),
--    and derive net from each session's live out_penalty instead of a stored value.
DROP VIEW IF EXISTS public.practice_player_stats;
CREATE VIEW public.practice_player_stats AS
WITH bat AS (
  SELECT b.player_id,
    SUM(b.runs) AS runs, SUM(b.balls_faced) AS balls, SUM(b.fours) AS fours,
    SUM(b.sixes) AS sixes, SUM(b.dots) AS dots, SUM(b.dismissals) AS dismissals,
    SUM(b.runs - b.dismissals * s.out_penalty) AS net,
    MAX(b.runs - b.dismissals * s.out_penalty) AS best
  FROM public.practice_batting b
  JOIN public.practice_sessions s ON s.id = b.session_id
  GROUP BY b.player_id
),
bowl AS (
  SELECT player_id, SUM(wickets) AS wickets, SUM(balls_bowled) AS balls_bowled,
         SUM(runs_conceded) AS runs_conceded
  FROM public.practice_bowling GROUP BY player_id
),
att AS (
  SELECT player_id, COUNT(*) FILTER (WHERE present) AS sessions_attended
  FROM public.practice_attendance GROUP BY player_id
)
SELECT
  p.id AS player_id, p.name, p.club_id, p.team_id,
  p.is_batsman, p.is_bowler, p.is_regular_bowler,
  COALESCE(att.sessions_attended, 0) AS sessions_attended,
  COALESCE(bat.runs, 0) AS total_runs, COALESCE(bat.balls, 0) AS total_balls,
  COALESCE(bat.fours, 0) AS total_fours, COALESCE(bat.sixes, 0) AS total_sixes,
  COALESCE(bat.dots, 0) AS total_dots, COALESCE(bat.dismissals, 0) AS total_dismissals,
  COALESCE(bat.net, 0) AS total_net, COALESCE(bat.best, 0) AS best_net,
  CASE WHEN COALESCE(bat.balls, 0) > 0
       THEN ROUND(100.0 * bat.runs / bat.balls, 1) ELSE 0 END AS strike_rate,
  COALESCE(bowl.wickets, 0) AS total_wickets,
  COALESCE(bowl.balls_bowled, 0) AS total_balls_bowled,
  COALESCE(bowl.runs_conceded, 0) AS total_runs_conceded
FROM public.practice_players p
LEFT JOIN bat  ON bat.player_id  = p.id
LEFT JOIN bowl ON bowl.player_id = p.id
LEFT JOIN att  ON att.player_id  = p.id;

-- 3) Matches: team-vs-team games within a club, reusing the roster.
CREATE TABLE IF NOT EXISTS public.matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name                TEXT,
  match_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  overs_per_side      INTEGER NOT NULL DEFAULT 6,
  team_a_id           UUID REFERENCES public.practice_teams(id) ON DELETE SET NULL,
  team_b_id           UUID REFERENCES public.practice_teams(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'SETUP' CHECK (status IN ('SETUP','LIVE','COMPLETED')),
  toss_winner_team_id UUID REFERENCES public.practice_teams(id) ON DELETE SET NULL,
  elected             TEXT CHECK (elected IN ('BAT','BOWL')),
  result_text         TEXT,
  winner_team_id      UUID REFERENCES public.practice_teams(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.match_lineups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES public.practice_players(id) ON DELETE CASCADE,
  team_id    UUID REFERENCES public.practice_teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_club ON public.matches(club_id);
CREATE INDEX IF NOT EXISTS idx_match_lineups_match ON public.match_lineups(match_id);

ALTER TABLE public.matches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['matches','match_lineups'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "practice_anon_all" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "practice_anon_all" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;
