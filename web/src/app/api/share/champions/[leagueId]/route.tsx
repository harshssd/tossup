import { ImageResponse } from 'next/og'
import { getChampionsForCard } from '@/lib/platform/queries'
import { TIER_META, toTier } from '@/lib/platform/recognition'

const INK = '#16150f'
const GOLD = '#c99a1e'

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export async function GET(_req: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const data = await getChampionsForCard(leagueId)
  // Only a concluded, public tournament with a champion yields a card (RLS hides
  // private ones → null). Negative-cache misses so enumeration hits the CDN.
  if (!data) {
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=60, s-maxage=300' } })
  }

  const { league, championName, runnerUpName } = data
  const tierColor = TIER_META[toTier(league.recognition_tier)].color
  const champion = truncate(championName, 28)
  // Scale the champion name so a long club name never overflows the card.
  const champSize = champion.length > 22 ? 84 : champion.length > 15 ? 104 : 128
  const runnerUp = runnerUpName ? truncate(runnerUpName, 30) : null

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
            // Warm gradient wash to set the silverware apart from the result card.
            backgroundImage: 'linear-gradient(150deg, #fbf3d6 0%, #f5f4ef 55%)',
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
                backgroundColor: '#fbe7b8',
                color: '#8a6d12',
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: 4,
              }}
            >
              CHAMPIONS
            </div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: '#6f6c63' }}>{truncate(league.name, 40)}</div>
          </div>

          {/* Champion */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ display: 'flex', width: 64, height: 64, borderRadius: 999, backgroundColor: GOLD }} />
              <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#8a6d12', letterSpacing: 2 }}>WINNERS</div>
            </div>
            <div style={{ display: 'flex', fontSize: champSize, fontWeight: 800, color: INK, lineHeight: 1.05 }}>{champion}</div>
            {runnerUp ? (
              <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, color: '#8a877d' }}>Runner-up · {runnerUp}</div>
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
      headers: { 'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
    }
  )
}
