import { platformDb } from '@/lib/platform/db'
import { buildFixturesCalendar } from '@/lib/platform/ics'

export const dynamic = 'force-dynamic'

// "The season in your calendar": a subscribable .ics of a tournament's scheduled
// fixtures. Anonymous read via platformDb — leagues/fixtures RLS hides PRIVATE
// tournaments (null → 404), mirroring the club events feed's trust rules
// (trusted base URL only, never the request host).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: league, error: leagueError } = await platformDb
    .from('leagues')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()
  if (leagueError) return new Response('Error loading tournament', { status: 500 })
  if (!league) return new Response('Tournament not found', { status: 404 })

  const { data: fixtures, error: fixturesError } = await platformDb
    .from('fixtures')
    .select('id, team_a_name, team_b_name, venue, scheduled_at, updated_at')
    .eq('league_id', id)
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true })
    .limit(500)
  if (fixturesError) return new Response('Error loading fixtures', { status: 500 })

  const ics = buildFixturesCalendar(league, fixtures ?? [], process.env.NEXT_PUBLIC_SITE_URL)
  const filename = `${league.name.replace(/[^a-z0-9-]/gi, '') || 'tournament'}-fixtures.ics`

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
