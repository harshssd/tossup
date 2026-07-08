'use client'

import { createPlatformBrowserClient } from './auth-browser'
import type { Fixture, League, Registration, Standing, TournamentTeam } from './queries'

// Tournament hosting with real ownership. These run as the *authenticated* user
// (not the anon platformDb), so owner_id / memberships are set as the creator and
// is_scope_admin resolves correctly.

/** Create a tournament owned by the current user: sets leagues.owner_id and adds
 *  an OWNER league_membership for the creator's self-Person. Requires sign-in. */
export async function createOwnedTournament(input: Partial<League> & { name: string }): Promise<League> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to host a tournament')

  const { data: league, error } = await supabase
    .from('leagues')
    .insert({ ...input, owner_id: user.id })
    .select()
    .single()
  if (error) throw new Error(error.message)

  // OWNER membership via the creator's self-Person. owner_id already grants admin
  // via is_scope_admin, so a membership hiccup is non-fatal.
  const { data: prof } = await supabase.from('users').select('primary_person_id').eq('id', user.id).maybeSingle()
  if (prof?.primary_person_id) {
    const { error: mErr } = await supabase
      .from('league_memberships')
      .insert({ league_id: league.id, person_id: prof.primary_person_id, role: 'OWNER' })
    if (mErr) console.error('owner membership:', mErr.message)
  }
  return league as League
}

/** Whether the current viewer is signed in and administers this tournament. */
export async function getTournamentAdminState(leagueId: string): Promise<{ signedIn: boolean; isAdmin: boolean }> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { signedIn: false, isAdmin: false }
  const { data } = await supabase.rpc('is_scope_admin', { p_user: user.id, p_scope: 'league', p_scope_id: leagueId })
  return { signedIn: true, isAdmin: data === true }
}

// Host write operations. These run as the authenticated user so the Phase 4
// is_scope_admin RLS on tournament_teams / fixtures admits them. RLS — not these
// helpers — is the real gate; the manage page only reaches them for admins.

export async function hostAddTeam(
  input: Partial<TournamentTeam> & { league_id: string; name: string }
): Promise<TournamentTeam> {
  const supabase = createPlatformBrowserClient()
  const { data, error } = await supabase.from('tournament_teams').insert(input).select().single()
  if (error) throw new Error(error.message)
  return data as TournamentTeam
}

export async function hostCreateFixture(input: Partial<Fixture> & { league_id: string }): Promise<Fixture> {
  const supabase = createPlatformBrowserClient()
  const { data, error } = await supabase.from('fixtures').insert(input).select().single()
  if (error) throw new Error(error.message)
  return data as Fixture
}

export async function hostSaveFixtureResult(id: string, patch: Partial<Fixture>): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase
    .from('fixtures')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Conclude a tournament: record champion (+ optional runner-up) and mint
 *  TOSSUP_VERIFIED honors into the winning clubs' cabinets. Host-only (RPC
 *  self-checks is_scope_admin). Re-callable — it rewrites verified honors. */
export async function concludeTournament(
  leagueId: string,
  championTeamId: string,
  runnerUpTeamId?: string | null
): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.rpc('conclude_tournament', {
    p_league_id: leagueId,
    p_champion_team_id: championTeamId,
    p_runner_up_team_id: runnerUpTeamId ?? undefined,
  })
  if (error) throw new Error(error.message)
}

/** Read a tournament as the authenticated admin. Mirrors queries.getTournament
 *  but uses the authed client so the admin-read RLS admits non-public
 *  tournaments too (the anon read path only sees PUBLIC ones). */
export async function getHostTournament(id: string): Promise<{
  league: League | null
  teams: TournamentTeam[]
  fixtures: Fixture[]
  standings: Standing[]
}> {
  const supabase = createPlatformBrowserClient()
  const [{ data: league }, { data: teams }, { data: fixtures }, { data: standings }] = await Promise.all([
    supabase.from('leagues').select('*').eq('id', id).maybeSingle(),
    supabase.from('tournament_teams').select('*').eq('league_id', id).order('name'),
    supabase.from('fixtures').select('*').eq('league_id', id).order('match_number', { nullsFirst: true }),
    supabase.from('tournament_standings').select('*').eq('league_id', id),
  ])
  return { league, teams: teams ?? [], fixtures: fixtures ?? [], standings: standings ?? [] }
}

// ---- Team registration ----

export interface MyAdminClub {
  id: string
  name: string
  slug: string
}

/** Clubs the signed-in user administers — the "register as your club" options.
 *  A registration tagged with one of these club_ids is the club's opt-in, which
 *  later lets conclude_tournament mint a verified honor into its cabinet. */
export async function getMyAdminClubs(): Promise<MyAdminClub[]> {
  const supabase = createPlatformBrowserClient()
  const { data, error } = await supabase.rpc('list_my_admin_clubs')
  if (error) return []
  return (data ?? []) as MyAdminClub[]
}

export interface RegisterTeamInput {
  league_id: string
  team_name: string
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notes?: string | null
  club_id?: string | null
}

/** Submit a team registration (PENDING) for the current user. Requires sign-in;
 *  RLS enforces user_id = self and status = PENDING. */
export async function registerTeam(input: RegisterTeamInput): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to register a team')
  const { error } = await supabase
    .from('tournament_registrations')
    .insert({ ...input, user_id: user.id, status: 'PENDING' })
  if (error) throw new Error(error.message)
}

/** The current user's registration for a tournament, if any (RLS: own row). */
export async function getMyRegistration(leagueId: string): Promise<Registration | null> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** All registrations for a tournament (RLS: admins see all). */
export async function getRegistrations(leagueId: string): Promise<Registration[]> {
  const supabase = createPlatformBrowserClient()
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Approve a registration: atomically creates the team + marks APPROVED.
 *  Authority is enforced inside the SECURITY DEFINER function. */
export async function approveRegistration(regId: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.rpc('approve_tournament_registration', { p_reg_id: regId })
  if (error) throw new Error(error.message)
}

/** Reject a registration (admin-only via RLS). */
export async function rejectRegistration(regId: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.from('tournament_registrations').update({ status: 'REJECTED' }).eq('id', regId)
  if (error) throw new Error(error.message)
}
