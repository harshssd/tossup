-- Practice Tracker schema (cricket net-practice micro-app)
-- Roster, sessions, attendance, batting/bowling stats with custom scoring rules.
-- Designed for an internal team tool consumed by the Expo mobile app via the anon key.

-- ---------------------------------------------------------------------------
-- Roster: players known to the team. Tag batsman / bowler / regular bowler.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_players (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT NOT NULL,
    is_batsman         BOOLEAN NOT NULL DEFAULT TRUE,
    is_bowler          BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE = counted bowler (gets a quota); FALSE = part-timer (Harsha, Gautham, ...)
    is_regular_bowler  BOOLEAN NOT NULL DEFAULT FALSE,
    active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- A practice session. Custom scoring rules live here so they are configurable
-- per session: each batsman faces `balls_per_batsman`, and every dismissal
-- subtracts `out_penalty` runs from their net score.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_sessions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT,
    session_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    balls_per_batsman  INTEGER NOT NULL DEFAULT 24,
    out_penalty        INTEGER NOT NULL DEFAULT 5,
    status             TEXT NOT NULL DEFAULT 'SETUP' CHECK (status IN ('SETUP','LIVE','COMPLETED')),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Attendance for a session + batting order.
-- arrival_order captures "who reached the ground first"; batting_order is the
-- (optionally fair-randomized) order they bat in.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_attendance (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    player_id      UUID NOT NULL REFERENCES public.practice_players(id) ON DELETE CASCADE,
    present        BOOLEAN NOT NULL DEFAULT TRUE,
    arrival_order  INTEGER,
    batting_order  INTEGER,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Batting result per player per session. net_score is materialized on save
-- (runs - dismissals * session.out_penalty) so cross-session aggregation is cheap.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_batting (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    player_id    UUID NOT NULL REFERENCES public.practice_players(id) ON DELETE CASCADE,
    balls_faced  INTEGER NOT NULL DEFAULT 0,
    runs         INTEGER NOT NULL DEFAULT 0,
    fours        INTEGER NOT NULL DEFAULT 0,
    sixes        INTEGER NOT NULL DEFAULT 0,
    dots         INTEGER NOT NULL DEFAULT 0,
    dismissals   INTEGER NOT NULL DEFAULT 0,
    net_score    INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Bowling result per player per session (optional, lightweight).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_bowling (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    player_id       UUID NOT NULL REFERENCES public.practice_players(id) ON DELETE CASCADE,
    balls_bowled    INTEGER NOT NULL DEFAULT 0,
    runs_conceded   INTEGER NOT NULL DEFAULT 0,
    wickets         INTEGER NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, player_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_practice_attendance_session ON public.practice_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_practice_batting_session ON public.practice_batting(session_id);
CREATE INDEX IF NOT EXISTS idx_practice_batting_player ON public.practice_batting(player_id);
CREATE INDEX IF NOT EXISTS idx_practice_bowling_session ON public.practice_bowling(session_id);
CREATE INDEX IF NOT EXISTS idx_practice_bowling_player ON public.practice_bowling(player_id);

-- ---------------------------------------------------------------------------
-- Continuous (career) batting stats across all sessions, per player.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.practice_player_stats AS
SELECT
    p.id                                            AS player_id,
    p.name,
    p.is_batsman,
    p.is_bowler,
    p.is_regular_bowler,
    COUNT(DISTINCT a.session_id) FILTER (WHERE a.present)                 AS sessions_attended,
    COALESCE(SUM(b.runs), 0)                                             AS total_runs,
    COALESCE(SUM(b.balls_faced), 0)                                      AS total_balls,
    COALESCE(SUM(b.fours), 0)                                           AS total_fours,
    COALESCE(SUM(b.sixes), 0)                                           AS total_sixes,
    COALESCE(SUM(b.dismissals), 0)                                      AS total_dismissals,
    COALESCE(SUM(b.net_score), 0)                                       AS total_net,
    COALESCE(MAX(b.net_score), 0)                                       AS best_net,
    CASE WHEN COALESCE(SUM(b.balls_faced),0) > 0
         THEN ROUND(100.0 * SUM(b.runs) / SUM(b.balls_faced), 1)
         ELSE 0 END                                                     AS strike_rate,
    COALESCE(SUM(w.wickets), 0)                                         AS total_wickets,
    COALESCE(SUM(w.balls_bowled), 0)                                    AS total_balls_bowled,
    COALESCE(SUM(w.runs_conceded), 0)                                   AS total_runs_conceded
FROM public.practice_players p
LEFT JOIN public.practice_attendance a ON a.player_id = p.id
LEFT JOIN public.practice_batting   b ON b.player_id = p.id
LEFT JOIN public.practice_bowling   w ON w.player_id = p.id
GROUP BY p.id, p.name, p.is_batsman, p.is_bowler, p.is_regular_bowler;

-- ---------------------------------------------------------------------------
-- RLS. This is an internal, unauthenticated team tool that talks to Supabase
-- with the anon key, so we allow anon + authenticated full access. Tighten
-- later if the app gains real auth.
-- ---------------------------------------------------------------------------
ALTER TABLE public.practice_players    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_batting    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_bowling    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'practice_players','practice_sessions','practice_attendance',
        'practice_batting','practice_bowling'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "practice_anon_all" ON public.%I;', t);
        EXECUTE format(
            'CREATE POLICY "practice_anon_all" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
            t
        );
    END LOOP;
END $$;
