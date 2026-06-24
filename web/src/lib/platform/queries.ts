import { platformDb } from './db'
import type { Database } from '@/lib/database.types'
import type { Tier } from './recognition'

export type Club = Database['public']['Tables']['clubs']['Row']
export type League = Database['public']['Tables']['leagues']['Row']
export type TournamentTeam = Database['public']['Tables']['tournament_teams']['Row']
export type Fixture = Database['public']['Tables']['fixtures']['Row']
export type PlayerProfile = Database['public']['Tables']['player_profiles']['Row']
export type Standing = Database['public']['Views']['tournament_standings']['Row']
export type Registration = Database['public']['Tables']['tournament_registrations']['Row']

function ilikeOr(cols: string[], q: string) {
  const safe = q.replace(/[%,()]/g, ' ').trim()
  return cols.map((c) => `${c}.ilike.%${safe}%`).join(',')
}

// ---------------- Clubs ----------------
export interface ClubFilters {
  q?: string
  country?: string
  region?: string
  tier?: Tier
  recruiting?: boolean
}

export async function listClubs(f: ClubFilters = {}): Promise<Club[]> {
  let query = platformDb.from('clubs').select('*').eq('visibility', 'PUBLIC')
  if (f.q) query = query.or(ilikeOr(['name', 'city', 'region', 'location', 'description'], f.q))
  if (f.country) query = query.eq('country', f.country)
  if (f.region) query = query.ilike('region', `%${f.region}%`)
  if (f.tier) query = query.eq('recognition_tier', f.tier)
  if (f.recruiting) query = query.eq('is_recruiting', true)
  const { data } = await query
    .order('recognition_tier', { ascending: true })
    .order('reputation_score', { ascending: false })
    .order('name', { ascending: true })
    .limit(100)
  return data ?? []
}

export async function getClubBySlug(slug: string): Promise<Club | null> {
  const { data } = await platformDb.from('clubs').select('*').eq('slug', slug).maybeSingle()
  return data
}

export async function countClubMembers(clubId: string): Promise<number> {
  const { count } = await platformDb
    .from('club_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
  return count ?? 0
}

// ---------------- Players ----------------
export interface PlayerFilters {
  q?: string
  country?: string
  region?: string
  role?: string
  lookingForClub?: boolean
}

export async function listPlayers(f: PlayerFilters = {}): Promise<PlayerProfile[]> {
  // Exclude tombstoned (merged-away) Persons from discovery.
  let query = platformDb.from('player_profiles').select('*').eq('visibility', 'PUBLIC').is('merged_into_id', null)
  if (f.q) query = query.or(ilikeOr(['display_name', 'city', 'region', 'bio'], f.q))
  if (f.country) query = query.eq('country', f.country)
  if (f.region) query = query.ilike('region', `%${f.region}%`)
  if (f.role) query = query.eq('primary_role', f.role)
  if (f.lookingForClub) query = query.eq('looking_for_club', true)
  const { data } = await query
    .order('recognition_tier', { ascending: true })
    .order('reputation_score', { ascending: false })
    .order('display_name', { ascending: true })
    .limit(100)
  return data ?? []
}

export async function getPlayer(id: string): Promise<PlayerProfile | null> {
  const { data } = await platformDb.from('player_profiles').select('*').eq('id', id).maybeSingle()
  return data
}

// ---------------- Tournaments ----------------
export interface TournamentFilters {
  q?: string
  country?: string
  region?: string
  tier?: Tier
  status?: string
}

export async function listTournaments(f: TournamentFilters = {}): Promise<League[]> {
  let query = platformDb.from('leagues').select('*').eq('visibility', 'PUBLIC')
  if (f.q) query = query.or(ilikeOr(['name', 'city', 'region', 'venue', 'description'], f.q))
  if (f.country) query = query.eq('country', f.country)
  if (f.region) query = query.ilike('region', `%${f.region}%`)
  if (f.tier) query = query.eq('recognition_tier', f.tier)
  if (f.status) query = query.eq('registration_status', f.status)
  const { data } = await query
    .order('recognition_tier', { ascending: true })
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(100)
  return data ?? []
}

export async function getTournament(id: string): Promise<{
  league: League | null
  teams: TournamentTeam[]
  fixtures: Fixture[]
  standings: Standing[]
}> {
  const [{ data: league }, { data: teams }, { data: fixtures }, { data: standings }] = await Promise.all([
    platformDb.from('leagues').select('*').eq('id', id).maybeSingle(),
    platformDb.from('tournament_teams').select('*').eq('league_id', id).order('name'),
    platformDb.from('fixtures').select('*').eq('league_id', id).order('match_number', { nullsFirst: true }),
    platformDb.from('tournament_standings').select('*').eq('league_id', id),
  ])
  return { league, teams: teams ?? [], fixtures: fixtures ?? [], standings: standings ?? [] }
}

// ---------------- Mutations (anon writes until auth lands) ----------------
function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function createClub(input: Partial<Club> & { name: string }) {
  const slug = `${slugify(input.name)}-${Math.random().toString(36).slice(2, 8)}`
  const { data, error } = await platformDb.from('clubs').insert({ ...input, slug }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function createPlayerProfile(input: Partial<PlayerProfile> & { display_name: string }) {
  const { data, error } = await platformDb.from('player_profiles').insert(input).select().single()
  if (error) throw new Error(error.message)
  return data
}

// Tournament create + host writes moved to lib/platform/tournament-host.ts —
// after Phase 4 RLS these must run as the authenticated admin, so the anon
// platformDb versions were removed to avoid a footgun that always fails RLS.
