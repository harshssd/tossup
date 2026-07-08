import { ImageResponse } from 'next/og'
import { getClubBySlug, countClubMembers } from '@/lib/platform/queries'
import { TIER_META, toTier, initials } from '@/lib/platform/recognition'

export const alt = 'Cricket club on TossUp'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const club = await getClubBySlug(slug)
  const tier = toTier(club?.recognition_tier)
  const tierColor = TIER_META[tier].color
  const place = club ? [club.city, club.region, club.country].filter(Boolean).join(', ') || club.location : null
  const members = club ? await countClubMembers(club.id) : 0

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
              CRICKET CLUB
            </div>
            <div
              style={{
                display: 'flex',
                padding: '8px 20px',
                borderRadius: 999,
                backgroundColor: tierColor,
                color: '#16150f',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 3,
              }}
            >
              {TIER_META[tier].label.toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 140,
                height: 140,
                borderRadius: 999,
                backgroundColor: '#1f9d57',
                color: '#ffffff',
                fontSize: 56,
                fontWeight: 800,
              }}
            >
              {club ? initials(club.name) : '?'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: '#16150f', lineHeight: 1.05 }}>
                {club?.name ?? 'Cricket club'}
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 30, color: '#6f6c63' }}>
                {place ? <span>{place}</span> : null}
                <span>
                  {members} member{members === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, color: '#6f6c63' }}>
            <div style={{ display: 'flex', width: 16, height: 16, borderRadius: 999, backgroundColor: '#c1121f' }} />
            <span style={{ fontWeight: 800, color: '#16150f' }}>TossUp</span>
            <span>· the home of grassroots cricket</span>
          </div>
        </div>
      </div>
    ),
    size
  )
}
