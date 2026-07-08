import { platformDb } from '@/lib/platform/db'
import { buildClubCalendar } from '@/lib/platform/ics'

export const dynamic = 'force-dynamic'

// Public iCalendar feed for a club's events (import into a calendar app; a webcal://
// subscribe affordance is a follow-up). Reads via the anon platform client — sibling
// clubs routes use the SSR client for the same DB, but this feed is intentionally
// unauthenticated, so RLS scopes it to PUBLIC clubs only (a PRIVATE club's row +
// events are invisible to anon → 404, matching the public club page's visibility).

// Recent past + all future, bounded. Past events give a subscribed calendar useful
// history without letting an old club's feed grow without limit.
const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000
const MAX_EVENTS = 500

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: club, error: clubError } = await platformDb
    .from('clubs')
    .select('id, name, slug')
    .eq('id', id)
    .maybeSingle()
  if (clubError) {
    console.error('events.ics club fetch:', clubError.message)
    return new Response('Error loading club', { status: 500 })
  }
  if (!club) {
    return new Response('Club not found', { status: 404 })
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_MS).toISOString()
  const { data: events, error: eventsError } = await platformDb
    .from('club_events')
    .select('*')
    .eq('club_id', id)
    // Recent-or-ongoing-or-future: ended within the window OR open-ended and started
    // within it. Windowing on ends_at (not starts_at) matches the club page's event
    // list, so a long-running/ongoing event shown there is also in the feed.
    .or(`ends_at.gte.${sinceIso},and(ends_at.is.null,starts_at.gte.${sinceIso})`)
    // Descending so if a busy club exceeds the cap we keep the most future-leaning
    // events (what a subscriber wants), not the oldest history. Order in the file
    // itself is irrelevant — calendar apps sort by date.
    .order('starts_at', { ascending: false })
    .limit(MAX_EVENTS)
  if (eventsError) console.error('events.ics events fetch:', eventsError.message)

  // baseUrl must be a trusted, server-configured origin — NOT the request host.
  // Absent today, so per-event URLs are omitted (see buildClubCalendar).
  const ics = buildClubCalendar(club, events ?? [], process.env.NEXT_PUBLIC_SITE_URL)
  const filename = `${(club.slug || 'club').replace(/[^a-z0-9-]/gi, '') || 'club'}-events.ics`

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // attachment: reliably hands the .ics to the OS calendar handler across
      // browsers (inline can render as raw text in a tab).
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Shared-cache + revalidate so the CDN absorbs calendar-app polling. Safe to
      // cache now that no request-derived host is baked into the body.
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
