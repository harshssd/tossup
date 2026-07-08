import type { SupabaseClient } from '@supabase/supabase-js'
import { platformDb } from './db'
import type { Database } from '@/lib/database.types'

type Db = SupabaseClient<Database>

// Honors board reads. Take a client so callers choose the trust level: anon
// (platformDb) for public server pages — respects public-read RLS — or the
// authed browser client so a club admin sees a PRIVATE club's honors too.

export type Honor = Database['public']['Tables']['honors']['Row']
export type HonorResult = 'CHAMPION' | 'RUNNER_UP' | 'THIRD' | 'SPECIAL'

export interface SquadMember {
  personId: string
  name: string
}

/** A club honor with its captain and squad resolved to display names. */
export interface HonorView extends Honor {
  captainName: string | null
  squad: SquadMember[]
}

/** A player's honor, flattened for the profile ribbon. */
export interface PlayerHonor {
  id: string
  title: string
  result: string
  year: number | null
  seasonLabel: string | null
  source: string
  clubId: string
  clubName: string | null
  clubSlug: string | null
  asCaptain: boolean
}

const RESULT_RANK: Record<string, number> = { CHAMPION: 0, RUNNER_UP: 1, THIRD: 2, SPECIAL: 3 }

// Cap reads: these run on anon-rendered, force-dynamic public pages, so an
// outlier club/player can't turn one request into an unbounded fetch.
const MAX_HONORS = 500

/** Resolve a set of person ids to a display-name map (PUBLIC profiles only). */
async function nameMap(db: Db, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const unique = [...new Set(ids)].filter(Boolean)
  if (!unique.length) return names
  const { data } = await db.from('player_profiles').select('id, display_name').in('id', unique)
  for (const p of data ?? []) names.set(p.id, p.display_name)
  return names
}

/** All honors in a club's cabinet, newest year first, with captain + squad names. */
export async function readClubHonors(db: Db, clubId: string): Promise<HonorView[]> {
  const { data: honors } = await db
    .from('honors')
    .select('*')
    .eq('club_id', clubId)
    .order('year', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(MAX_HONORS)
  if (!honors?.length) return []

  const ids = honors.map((h) => h.id)
  const { data: squadRows } = await db
    .from('honor_squad_members')
    .select('honor_id, person_id')
    .in('honor_id', ids)

  const squadByHonor = new Map<string, string[]>()
  for (const r of squadRows ?? []) {
    const arr = squadByHonor.get(r.honor_id) ?? []
    arr.push(r.person_id)
    squadByHonor.set(r.honor_id, arr)
  }

  const names = await nameMap(db, [
    ...honors.map((h) => h.captain_person_id).filter((x): x is string => !!x),
    ...(squadRows ?? []).map((r) => r.person_id),
  ])

  return honors.map((h) => ({
    ...h,
    captainName: h.captain_person_id ? names.get(h.captain_person_id) ?? null : null,
    squad: (squadByHonor.get(h.id) ?? [])
      .map((personId) => ({ personId, name: names.get(personId) ?? 'Unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

/** Public-page read (anonymous, honors of PUBLIC clubs). */
export function getClubHonors(clubId: string): Promise<HonorView[]> {
  return readClubHonors(platformDb, clubId)
}

/** Honors a person earned — as captain or squad member — for their profile ribbon. */
export async function getPlayerHonors(personId: string): Promise<PlayerHonor[]> {
  const [asCaptain, inSquad] = await Promise.all([
    platformDb.from('honors').select('*').eq('captain_person_id', personId).limit(MAX_HONORS),
    platformDb.from('honor_squad_members').select('honor_id').eq('person_id', personId).limit(MAX_HONORS),
  ])

  const captainHonors = asCaptain.data ?? []
  const squadHonorIds = (inSquad.data ?? []).map((r) => r.honor_id)
  const captainIds = new Set(captainHonors.map((h) => h.id))
  const extraIds = squadHonorIds.filter((id) => !captainIds.has(id))

  let squadHonors: Honor[] = []
  if (extraIds.length) {
    const { data } = await platformDb.from('honors').select('*').in('id', extraIds)
    squadHonors = data ?? []
  }

  const all = [
    ...captainHonors.map((h) => ({ h, asCaptain: true })),
    ...squadHonors.map((h) => ({ h, asCaptain: false })),
  ]
  if (!all.length) return []

  const clubIds = [...new Set(all.map(({ h }) => h.club_id))]
  const { data: clubs } = await platformDb.from('clubs').select('id, name, slug').in('id', clubIds)
  const clubMap = new Map((clubs ?? []).map((c) => [c.id, c]))

  return all
    .map(({ h, asCaptain }) => {
      const club = clubMap.get(h.club_id)
      return {
        id: h.id,
        title: h.title,
        result: h.result,
        year: h.year,
        seasonLabel: h.season_label,
        source: h.source,
        clubId: h.club_id,
        clubName: club?.name ?? null,
        clubSlug: club?.slug ?? null,
        asCaptain,
      }
    })
    .sort(
      (a, b) =>
        (b.year ?? 0) - (a.year ?? 0) ||
        (RESULT_RANK[a.result] ?? 9) - (RESULT_RANK[b.result] ?? 9)
    )
}
