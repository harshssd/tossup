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

/** Upcoming (or all) events for a club, with public GOING/MAYBE counts attached.
 *  `db` chooses the trust level: anon for the public page, authed for manage. */
export async function readClubEvents(
  db: Db,
  clubId: string,
  opts?: { upcoming?: boolean }
): Promise<EventWithCounts[]> {
  const upcoming = opts?.upcoming ?? true
  let q = db.from('club_events').select('*').eq('club_id', clubId)
  if (upcoming) q = q.gte('starts_at', new Date().toISOString())
  const { data: events } = await q.order('starts_at', { ascending: true }).limit(MAX_EVENTS)
  if (!events?.length) return []

  const ids = events.map((e) => e.id)
  // Public aggregate counts (PUBLIC clubs only). For a PRIVATE club's manage
  // view the view returns nothing, so counts fall back to 0 there — the admin
  // still sees the attendee list via the events section if needed.
  const { data: counts } = await db
    .from('club_event_rsvp_counts')
    .select('event_id, going, maybe')
    .in('event_id', ids)
  const cmap = new Map((counts ?? []).map((c) => [c.event_id, c]))

  return events.map((e) => ({
    ...e,
    going: cmap.get(e.id)?.going ?? 0,
    maybe: cmap.get(e.id)?.maybe ?? 0,
  }))
}

/** Public-page read (anonymous, upcoming events of a PUBLIC club). */
export function getClubEvents(clubId: string): Promise<EventWithCounts[]> {
  return readClubEvents(platformDb, clubId, { upcoming: true })
}
