// Mirrors the practice_* tables in Supabase.

export type SessionStatus = 'SETUP' | 'LIVE' | 'COMPLETED';

export interface Club {
  id: string;
  name: string;
  created_at: string;
}

export interface Team {
  id: string;
  club_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  name: string;
  club_id: string | null;
  team_id: string | null;
  is_batsman: boolean;
  is_bowler: boolean;
  is_regular_bowler: boolean;
  active: boolean;
  created_at: string;
}

export interface PracticeSession {
  id: string;
  club_id: string | null;
  name: string | null;
  session_date: string;
  balls_per_batsman: number;
  out_penalty: number;
  status: SessionStatus;
  notes: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  player_id: string;
  present: boolean;
  arrival_order: number | null;
  batting_order: number | null;
  created_at: string;
}

export interface Batting {
  id: string;
  session_id: string;
  player_id: string;
  balls_faced: number;
  runs: number;
  fours: number;
  sixes: number;
  dots: number;
  dismissals: number;
  net_score: number;
  updated_at: string;
}

export interface Bowling {
  id: string;
  session_id: string;
  player_id: string;
  balls_bowled: number;
  runs_conceded: number;
  wickets: number;
  updated_at: string;
}

export interface PlayerStats {
  player_id: string;
  name: string;
  club_id: string | null;
  team_id: string | null;
  is_batsman: boolean;
  is_bowler: boolean;
  is_regular_bowler: boolean;
  sessions_attended: number;
  total_runs: number;
  total_balls: number;
  total_fours: number;
  total_sixes: number;
  total_dots: number;
  total_dismissals: number;
  total_net: number;
  best_net: number;
  strike_rate: number;
  total_wickets: number;
  total_balls_bowled: number;
  total_runs_conceded: number;
}
