import { ImageResponse } from 'next/og'
import { getFixtureForCard } from '@/lib/platform/queries'
import { formatCricketScore, formatMatchDate } from '@/lib/platform/share'
import { TIER_META, toTier } from '@/lib/platform/recognition'
import { Frame, HeaderBadge, TeamRow, VersusDivider, Chip, truncate } from '@/lib/platform/share-card'

const IMG_OPTS = {
  width: 1080,
  height: 1080,
  headers: { 'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
} as const

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getFixtureForCard(id)
  // A card only makes sense for a completed (result) or scheduled (announced)
  // fixture in a public tournament (RLS already hides private ones → data is null).
  const status = data?.fixture.status
  if (!data || (status !== 'COMPLETED' && status !== 'SCHEDULED')) {
    // Negative-cache so UUID enumeration / misses are absorbed by the CDN
    // instead of hitting the origin (2 anon DB round-trips) every time.
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=60, s-maxage=300' } })
  }

  const { fixture: fx, league } = data
  const tierColor = TIER_META[toTier(league?.recognition_tier)].color
  const aName = truncate(fx.team_a_name ?? 'Team A', 26)
  const bName = truncate(fx.team_b_name ?? 'Team B', 26)
  // Scale team text down for longer names so a big name never reflows the column.
  const nameSize = Math.max(aName.length, bName.length) > 22 ? 44 : Math.max(aName.length, bName.length) > 16 ? 54 : 64

  if (status === 'SCHEDULED') {
    const when = formatMatchDate(fx.scheduled_at)
    const venue = fx.venue ? truncate(fx.venue, 48) : null
    return new ImageResponse(
      (
        <Frame tierColor={tierColor}>
          <HeaderBadge label="MATCH ANNOUNCED" league={league?.name ?? null} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {/* No winner yet → both teams at full strength (emphasis). */}
            <TeamRow name={aName} won={false} size={nameSize} emphasis />
            <VersusDivider />
            <TeamRow name={bName} won={false} size={nameSize} emphasis />
            {(when || venue) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 8 }}>
                {when && <Chip text={when} />}
                {venue && <Chip text={venue} />}
              </div>
            )}
          </div>
        </Frame>
      ),
      IMG_OPTS
    )
  }

  // COMPLETED — result card.
  const aWon = !!fx.winner_team_id && fx.winner_team_id === fx.team_a_id
  const bWon = !!fx.winner_team_id && fx.winner_team_id === fx.team_b_id
  const heading = fx.round_label || (fx.match_number ? `Match ${fx.match_number}` : 'Result')
  const note = fx.result_note ? truncate(fx.result_note, 64) : null
  const noteSize = note && note.length > 30 ? 30 : 38

  return new ImageResponse(
    (
      <Frame tierColor={tierColor}>
        <HeaderBadge label={heading.toUpperCase()} league={league?.name ?? null} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <TeamRow name={aName} sc={formatCricketScore(fx.team_a_runs, fx.team_a_wickets, fx.team_a_overs)} won={aWon} size={nameSize} />
          <VersusDivider />
          <TeamRow name={bName} sc={formatCricketScore(fx.team_b_runs, fx.team_b_wickets, fx.team_b_overs)} won={bWon} size={nameSize} />
          {note ? <Chip text={note} size={noteSize} /> : null}
        </div>
      </Frame>
    ),
    IMG_OPTS
  )
}
