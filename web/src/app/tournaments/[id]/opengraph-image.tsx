import { ImageResponse } from 'next/og'
import { getTournament } from '@/lib/platform/queries'
import { TIER_META, toTier } from '@/lib/platform/recognition'
import { formatPlace, formatDateRange } from '@/lib/platform/format'

export const alt = 'Cricket tournament on TossUp'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { league, standings } = await getTournament(id)
  const tier = toTier(league?.recognition_tier)
  const tierColor = TIER_META[tier].color
  const place = league ? formatPlace(league, league.venue) : null
  const dates = formatDateRange(league?.start_date, league?.end_date)
  const leader = [...standings].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0))[0]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#f5f4ef',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', width: 18, backgroundColor: tierColor }} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexGrow: 1,
            padding: '64px 72px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                padding: '8px 20px',
                borderRadius: 999,
                backgroundColor: '#e7f4ec',
                color: '#0f5a30',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 3,
              }}
            >
              {(league?.format || league?.type || 'TOURNAMENT').toUpperCase()}
            </div>
            {league ? (
              <div
                style={{
                  display: 'flex',
                  padding: '8px 20px',
                  borderRadius: 999,
                  backgroundColor: league.registration_status === 'OPEN' ? '#1f9d57' : '#efede6',
                  color: league.registration_status === 'OPEN' ? '#ffffff' : '#6f6c63',
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: 3,
                }}
              >
                {league.registration_status === 'OPEN' ? 'REGISTRATION OPEN' : league.registration_status}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: '#16150f', lineHeight: 1.05 }}>
              {league?.name ?? 'Cricket tournament'}
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 18, fontSize: 30, color: '#6f6c63' }}>
              {place ? <span>{place}</span> : null}
              {dates ? <span>{dates}</span> : null}
            </div>
            {leader && Number(leader.played) > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  alignSelf: 'flex-start',
                  marginTop: 24,
                  padding: '10px 22px',
                  borderRadius: 999,
                  backgroundColor: '#fcf3d6',
                  color: '#9a6b09',
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 999, backgroundColor: '#f4c430' }} />
                Leading: {leader.name} · {Number(leader.points)} pts
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, color: '#6f6c63' }}>
            <div style={{ display: 'flex', width: 16, height: 16, borderRadius: 999, backgroundColor: '#c1121f' }} />
            <span style={{ fontWeight: 800, color: '#16150f' }}>TossUp</span>
            <span>· live standings & results</span>
          </div>
        </div>
      </div>
    ),
    size
  )
}
