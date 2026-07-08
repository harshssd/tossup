import { NextRequest } from 'next/server'
import { platformDb } from '@/lib/platform/db'
import { buildClubCalendar } from '@/lib/platform/ics'
import type { ClubEvent } from '@/lib/platform/events'

export const dynamic = 'force-dynamic'

// Public iCalendar feed for a club's events (subscribe / import into a calendar).
// Reads via the anon client, so RLS scopes it to PUBLIC clubs only — a PRIVATE
// club (whose row and events anon can't read) yields a 404, matching the public
// club page's visibility. A member-token feed for PRIVATE clubs is a follow-up.

// Recent past + all future, bounded. Past events give a subscribed calendar useful
// history without letting an old club's feed grow without limit.
const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000
const MAX_EVENTS = 500

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: club } = await platformDb
    .from('clubs')
    .select('id, name, slug')
    .eq('id', id)
    .maybeSingle()
  if (!club) {
    return new Response('Club not found', { status: 404 })
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_MS).toISOString()
  const { data: events } = await platformDb
    .from('club_events')
    .select('*')
    .eq('club_id', id)
    .gte('starts_at', sinceIso)
    .order('starts_at', { ascending: true })
    .limit(MAX_EVENTS)

  const origin = new URL(request.url).origin
  const ics = buildClubCalendar(club, (events ?? []) as ClubEvent[], origin)
  const filename = `${club.slug || 'club'}-events.ics`

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}"`,
      // Calendar apps re-poll; an hour of caching is plenty and cuts load.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
