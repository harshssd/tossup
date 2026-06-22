import { supabase } from './supabase';
import { netScore } from './scoring';
import type {
  Club,
  Team,
  Player,
  PracticeSession,
  Attendance,
  Batting,
  Bowling,
  PlayerStats,
  SessionStatus,
} from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---- Clubs ---------------------------------------------------------------
export async function listClubs(): Promise<Club[]> {
  return unwrap(await supabase.from('clubs').select('*').order('created_at'));
}

export async function createClub(name: string): Promise<Club> {
  return unwrap(await supabase.from('clubs').insert({ name }).select().single());
}

// ---- Teams ---------------------------------------------------------------
export async function listTeams(clubId: string): Promise<Team[]> {
  return unwrap(
    await supabase.from('practice_teams').select('*').eq('club_id', clubId).order('created_at'),
  );
}

export async function createTeam(clubId: string, name: string, color: string): Promise<Team> {
  return unwrap(
    await supabase.from('practice_teams').insert({ club_id: clubId, name, color }).select().single(),
  );
}

export async function deleteTeam(id: string): Promise<void> {
  unwrap(await supabase.from('practice_teams').delete().eq('id', id).select('id'));
}

/** Move a player to a team, or to the unassigned practice pool (teamId = null). */
export async function setPlayerTeam(playerId: string, teamId: string | null): Promise<void> {
  unwrap(await supabase.from('practice_players').update({ team_id: teamId }).eq('id', playerId).select('id'));
}

// ---- Players -------------------------------------------------------------
export async function listPlayers(clubId: string, includeInactive = false): Promise<Player[]> {
  let q = supabase.from('practice_players').select('*').eq('club_id', clubId).order('name');
  if (!includeInactive) q = q.eq('active', true);
  return unwrap(await q);
}

export async function createPlayer(input: {
  club_id: string;
  name: string;
  is_batsman: boolean;
  is_bowler: boolean;
  is_regular_bowler: boolean;
  team_id?: string | null;
}): Promise<Player> {
  return unwrap(await supabase.from('practice_players').insert(input).select().single());
}

export async function updatePlayer(id: string, patch: Partial<Player>): Promise<Player> {
  return unwrap(await supabase.from('practice_players').update(patch).eq('id', id).select().single());
}

// ---- Sessions ------------------------------------------------------------
export async function listSessions(clubId: string): Promise<PracticeSession[]> {
  return unwrap(
    await supabase
      .from('practice_sessions')
      .select('*')
      .eq('club_id', clubId)
      .order('session_date', { ascending: false }),
  );
}

export async function getSession(id: string): Promise<PracticeSession> {
  return unwrap(await supabase.from('practice_sessions').select('*').eq('id', id).single());
}

export async function createSession(input: {
  club_id: string;
  name: string | null;
  session_date: string;
  balls_per_batsman: number;
  out_penalty: number;
}): Promise<PracticeSession> {
  return unwrap(await supabase.from('practice_sessions').insert(input).select().single());
}

export async function setSessionStatus(id: string, status: SessionStatus): Promise<void> {
  unwrap(await supabase.from('practice_sessions').update({ status }).eq('id', id).select('id'));
}

// ---- Attendance ----------------------------------------------------------
export async function listAttendance(sessionId: string): Promise<Attendance[]> {
  return unwrap(
    await supabase.from('practice_attendance').select('*').eq('session_id', sessionId),
  );
}

export async function upsertAttendance(
  rows: Array<Pick<Attendance, 'session_id' | 'player_id'> & Partial<Attendance>>,
): Promise<void> {
  unwrap(
    await supabase
      .from('practice_attendance')
      .upsert(rows, { onConflict: 'session_id,player_id' })
      .select('id'),
  );
}

/** Historical avg batting position per player, across previous sessions. */
export async function getHistoricalOrders(): Promise<Record<string, number>> {
  const rows = unwrap(
    await supabase
      .from('practice_attendance')
      .select('player_id, batting_order')
      .not('batting_order', 'is', null),
  ) as Array<{ player_id: string; batting_order: number }>;
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const r of rows) {
    acc[r.player_id] ??= { sum: 0, n: 0 };
    acc[r.player_id].sum += r.batting_order;
    acc[r.player_id].n += 1;
  }
  const out: Record<string, number> = {};
  for (const [pid, { sum, n }] of Object.entries(acc)) out[pid] = sum / n;
  return out;
}

// ---- Batting -------------------------------------------------------------
export async function listBatting(sessionId: string): Promise<Batting[]> {
  return unwrap(await supabase.from('practice_batting').select('*').eq('session_id', sessionId));
}

export async function saveBatting(
  sessionId: string,
  playerId: string,
  stats: { balls_faced: number; runs: number; fours: number; sixes: number; dots: number; dismissals: number },
  outPenalty: number,
): Promise<void> {
  const row = {
    session_id: sessionId,
    player_id: playerId,
    ...stats,
    net_score: netScore(stats.runs, stats.dismissals, outPenalty),
    updated_at: new Date().toISOString(),
  };
  unwrap(
    await supabase
      .from('practice_batting')
      .upsert(row, { onConflict: 'session_id,player_id' })
      .select('id'),
  );
}

// ---- Bowling -------------------------------------------------------------
export async function listBowling(sessionId: string): Promise<Bowling[]> {
  return unwrap(await supabase.from('practice_bowling').select('*').eq('session_id', sessionId));
}

export async function saveBowling(
  sessionId: string,
  playerId: string,
  stats: { balls_bowled: number; runs_conceded: number; wickets: number },
): Promise<void> {
  unwrap(
    await supabase
      .from('practice_bowling')
      .upsert(
        { session_id: sessionId, player_id: playerId, ...stats, updated_at: new Date().toISOString() },
        { onConflict: 'session_id,player_id' },
      )
      .select('id'),
  );
}

// ---- Stats ---------------------------------------------------------------
export async function getPlayerStats(clubId: string): Promise<PlayerStats[]> {
  return unwrap(
    await supabase
      .from('practice_player_stats')
      .select('*')
      .eq('club_id', clubId)
      .order('total_net', { ascending: false }),
  );
}
