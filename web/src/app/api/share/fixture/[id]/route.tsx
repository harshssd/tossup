import { ImageResponse } from 'next/og'
import { getFixtureForCard } from '@/lib/platform/queries'
import { formatCricketScore } from '@/lib/platform/share'
import { TIER_META, toTier } from '@/lib/platform/recognition'

const GREEN = '#1f9d57'
const INK = '#16150f'
const MUTED = '#8a877d'

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function TeamRow({ name, sc, won, size }: { name: string; sc: string | null; won: boolean; size: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 1, minWidth: 0 }}>
        {won ? (
          <div style={{ display: 'flex', width: 24, height: 24, borderRadius: 999, backgroundColor: GREEN }} />
        ) : (
          <div style={{ display: 'flex', width: 24, height: 24 }} />
        )}
        <div style={{ display: 'flex', fontSize: size, fontWeight: 800, color: won ? INK : MUTED, lineHeight: 1.1 }}>{name}</div>
      </div>
      <div style={{ display: 'flex', fontSize: size, fontWeight: 800, color: won ? GREEN : MUTED }}>{sc ?? '—'}</div>
    </div>
  )
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getFixtureForCard(id)
  // A result card only makes sense for a completed fixture in a public tournament
  // (RLS already hides private ones → data is null).
  if (!data || data.fixture.status !== 'COMPLETED') {
    // Negative-cache so UUID enumeration / misses are absorbed by the CDN
    // instead of hitting the origin (2 anon DB round-trips) every time.
    return new Response('Not found', {
      status: 404,
      headers: { 'cache-control': 'public, max-age=60, s-maxage=300' },
    })
  }
  const { fixture: fx, league } = data
  const tierColor = TIER_META[toTier(league?.recognition_tier)].color
  const aName = truncate(fx.team_a_name ?? 'Team A', 26)
  const bName = truncate(fx.team_b_name ?? 'Team B', 26)
  const aWon = !!fx.winner_team_id && fx.winner_team_id === fx.team_a_id
  const bWon = !!fx.winner_team_id && fx.winner_team_id === fx.team_b_id
  const heading = fx.round_label || (fx.match_number ? `Match ${fx.match_number}` : 'Result')
  // Scale team text down for longer names so a big name never reflows the column.
  const nameSize = Math.max(aName.length, bName.length) > 22 ? 44 : Math.max(aName.length, bName.length) > 16 ? 54 : 64
  const note = fx.result_note ? truncate(fx.result_note, 64) : null
  const noteSize = note && note.length > 30 ? 30 : 38

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: '#f5f4ef', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', width: 24, backgroundColor: tierColor }} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexGrow: 1,
            padding: '84px 88px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                padding: '10px 26px',
                borderRadius: 999,
                backgroundColor: '#e7f4ec',
                color: '#0f5a30',
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 3,
              }}
            >
              {heading.toUpperCase()}
            </div>
            {league?.name ? (
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: '#6f6c63' }}>{league.name}</div>
            ) : null}
          </div>

          {/* Teams + scores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <TeamRow name={aName} sc={formatCricketScore(fx.team_a_runs, fx.team_a_wickets, fx.team_a_overs)} won={aWon} size={nameSize} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ display: 'flex', height: 2, flexGrow: 1, backgroundColor: '#ded9cd' }} />
              <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#b8b3a6', letterSpacing: 4 }}>VS</div>
              <div style={{ display: 'flex', height: 2, flexGrow: 1, backgroundColor: '#ded9cd' }} />
            </div>
            <TeamRow name={bName} sc={formatCricketScore(fx.team_b_runs, fx.team_b_wickets, fx.team_b_overs)} won={bWon} size={nameSize} />
            {note ? (
              <div
                style={{
                  display: 'flex',
                  alignSelf: 'flex-start',
                  marginTop: 8,
                  padding: '14px 30px',
                  borderRadius: 999,
                  backgroundColor: '#e7f4ec',
                  color: '#0f5a30',
                  fontSize: noteSize,
                  fontWeight: 800,
                }}
              >
                {note}
              </div>
            ) : null}
          </div>

          {/* Footer / brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34, color: '#6f6c63' }}>
            <div style={{ display: 'flex', width: 22, height: 22, borderRadius: 999, backgroundColor: '#c1121f' }} />
            <span style={{ fontWeight: 800, color: INK }}>TossUp</span>
            <span>· made with tossup.app</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      headers: {
        'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  )
}
