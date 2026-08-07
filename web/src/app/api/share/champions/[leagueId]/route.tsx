import { ImageResponse } from 'next/og'
import { getChampionsForCard } from '@/lib/platform/queries'
import { TIER_META, toTier } from '@/lib/platform/recognition'
import { Frame, HeaderBadge, TrophyMark, INK, truncate } from '@/lib/platform/share-card'

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
      // Warm gold wash sets the silverware apart from the result card.
      <Frame tierColor={tierColor} backgroundImage="linear-gradient(150deg, #fbf3d6 0%, #f5f4ef 55%)">
        <HeaderBadge label="CHAMPIONS" league={truncate(league.name, 40)} tone="gold" />

        {/* Champion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex' }}>
            <TrophyMark size={92} />
          </div>
          <div style={{ display: 'flex', fontSize: champSize, fontWeight: 800, color: INK, lineHeight: 1.05 }}>{champion}</div>
          {runnerUp ? (
            <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, color: '#8a877d' }}>Runner-up · {runnerUp}</div>
          ) : null}
        </div>
      </Frame>
    ),
    {
      width: 1080,
      height: 1080,
      headers: { 'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
    }
  )
}
