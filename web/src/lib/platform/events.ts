import type { SupabaseClient } from '@supabase/supabase-js'
import { platformDb } from './db'
import type { Database } from '@/lib/database.types'

type Db = SupabaseClient<Database>

// Club events reads. Anon (platformDb) sees PUBLIC clubs' events on the public
// club page; an authed admin client sees a PRIVATE club's events too.

export type ClubEvent = Database['public']['Tables']['club_events']['Row']
export type EventType = Database['public']['Enums']['event_type']
export type RsvpStatus = Database['public']['Enums']['rsvp_status']

export interface EventWithCounts extends ClubEvent {
  going: number
  maybe: number
}

export const EVENT_TYPE_LABEL: Record<string, string> = {
  PRACTICE: 'Practice',
  MATCH: 'Match',
  SOCIAL: 'Social',
  OTHER: 'Event',
}

// Cap reads: runs on an anon, force-dynamic public page.
const MAX_EVENTS = 200
// Keep events that started but haven't ended visible even when ends_at is null,
// so an in-progress practice/match (the "find a game right now" case) doesn't
// vanish the instant it starts.
const LIVE_GRACE_MS = 3 * 60 * 60 * 1000

type Counts = Map<string, { going: number; maybe: number }>

/** Public, PUBLIC-club-scoped aggregate counts (anon-safe, never exposes who). */
async function countsFromView(db: Db, ids: string[]): Promise<Counts> {
  const { data } = await db.from('club_event_rsvp_counts').select('event_id, going, maybe').in('event_id', ids)
  const m: Counts = new Map()
  for (const c of data ?? []) {
    if (c.event_id) m.set(c.event_id, { going: c.going ?? 0, maybe: c.maybe ?? 0 })
  }
  return m
}

/** Counts computed from the raw RSVP rows the caller can read (ersvp_member_select).
 *  Used by the admin manage path so PRIVATE clubs — invisible to the public view —
 *  still get real attendance numbers. */
async function countsFromRsvpRows(db: Db, ids: string[]): Promise<Counts> {
  const { data } = await db.from('event_rsvps').select('event_id, status').in('event_id', ids)
  const m: Counts = new Map()
  for (const r of data ?? []) {
    const c = m.get(r.event_id) ?? { going: 0, maybe: 0 }
    if (r.status === 'GOING') c.going++
    else if (r.status === 'MAYBE') c.maybe++
    m.set(r.event_id, c)
  }
  return m
}

/** Upcoming (or all) events for a club, with GOING/MAYBE counts attached.
 *  `db` chooses the trust level: anon for the public page, authed for manage.
 *  `countsFromRsvps` aggregates the attendee rows instead of the public view —
 *  required for PRIVATE clubs, which the view excludes. */
export async function readClubEvents(
  db: Db,
  clubId: string,
  opts?: { upcoming?: boolean; countsFromRsvps?: boolean }
): Promise<EventWithCounts[]> {
  const upcoming = opts?.upcoming ?? true
  let q = db.from('club_events').select('*').eq('club_id', clubId)
  if (upcoming) {
    const now = new Date()
    const nowIso = now.toISOString()
    const graceIso = new Date(now.getTime() - LIVE_GRACE_MS).toISOString()
    // Not yet ended (ends_at in the future) OR open-ended and started within grace.
    q = q.or(`ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${graceIso})`)
  }
  const { data: events } = await q.order('starts_at', { ascending: true }).limit(MAX_EVENTS)
  if (!events?.length) return []

  const ids = events.map((e) => e.id)
  const counts = opts?.countsFromRsvps ? await countsFromRsvpRows(db, ids) : await countsFromView(db, ids)

  return events.map((e) => ({
    ...e,
    going: counts.get(e.id)?.going ?? 0,
    maybe: counts.get(e.id)?.maybe ?? 0,
  }))
}

/** Public-page read (anonymous, upcoming/live events of a PUBLIC club). */
export function getClubEvents(clubId: string): Promise<EventWithCounts[]> {
  return readClubEvents(platformDb, clubId, { upcoming: true })
}

/** How much an optimistic GOING tally shifts when a user's RSVP moves
 *  prev → next (either may be undefined = no RSVP). Antisymmetric, so a revert
 *  is `goingDelta(next, prev)`. Pure — unit-tested. */
export function goingDelta(prev: RsvpStatus | undefined, next: RsvpStatus | undefined): number {
  return (next === 'GOING' ? 1 : 0) - (prev === 'GOING' ? 1 : 0)
}
