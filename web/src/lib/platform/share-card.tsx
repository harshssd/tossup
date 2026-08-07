import type { ReactNode } from 'react'

// Shared building blocks for the 1080×1080 share cards (result / announced /
// champions), rendered by the /api/share/* routes via next/og. Kept in one place
// so the tier accent rail, header badge, team rows, and brand footer stay
// visually identical across every card — a card touched in isolation can't drift.

export const INK = '#16150f'
export const GREEN = '#1f9d57'
export const MUTED = '#8a877d'
export const GOLD = '#c99a1e'

export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Outer frame: tier accent rail + padded column + brand footer. `backgroundImage`
 *  lets a card (e.g. champions) wash the column without forking the frame. */
export function Frame({
  tierColor,
  backgroundImage,
  children,
}: {
  tierColor: string
  backgroundImage?: string
  children: ReactNode
}) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: '#f5f4ef', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', width: 24, backgroundColor: tierColor }} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexGrow: 1,
          padding: '84px 88px',
          ...(backgroundImage ? { backgroundImage } : {}),
        }}
      >
        {children}
        <BrandFooter />
      </div>
    </div>
  )
}

function BrandFooter() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34, color: '#6f6c63' }}>
      <div style={{ display: 'flex', width: 22, height: 22, borderRadius: 999, backgroundColor: '#c1121f' }} />
      <span style={{ fontWeight: 800, color: INK }}>TossUp</span>
      <span>· made with tossup.app</span>
    </div>
  )
}

const BADGE_TONE = {
  green: { bg: '#e7f4ec', color: '#0f5a30', letterSpacing: 3, weight: 700 },
  gold: { bg: '#fbe7b8', color: '#8a6d12', letterSpacing: 4, weight: 800 },
} as const

/** Card-type pill (e.g. "RESULT", "MATCH ANNOUNCED", "CHAMPIONS") + the
 *  tournament name beneath it. */
export function HeaderBadge({
  label,
  league,
  tone = 'green',
}: {
  label: string
  league: string | null
  tone?: 'green' | 'gold'
}) {
  const t = BADGE_TONE[tone]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          alignSelf: 'flex-start',
          padding: '10px 26px',
          borderRadius: 999,
          backgroundColor: t.bg,
          color: t.color,
          fontSize: 30,
          fontWeight: t.weight,
          letterSpacing: t.letterSpacing,
        }}
      >
        {label}
      </div>
      {league ? <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: '#6f6c63' }}>{league}</div> : null}
    </div>
  )
}

/** One team line. `emphasis` forces full-strength INK (used on the announced card
 *  where there's no winner); otherwise the winner is INK/green and the loser
 *  muted (result card hierarchy). Omit `sc` to hide the score cell entirely. */
export function TeamRow({
  name,
  sc,
  won,
  size,
  emphasis,
}: {
  name: string
  sc?: string | null
  won: boolean
  size: number
  emphasis?: boolean
}) {
  const nameColor = emphasis || won ? INK : MUTED
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 1, minWidth: 0 }}>
        {won ? (
          <div style={{ display: 'flex', width: 24, height: 24, borderRadius: 999, backgroundColor: GREEN }} />
        ) : (
          <div style={{ display: 'flex', width: 24, height: 24 }} />
        )}
        <div style={{ display: 'flex', fontSize: size, fontWeight: 800, color: nameColor, lineHeight: 1.1 }}>{name}</div>
      </div>
      {sc !== undefined && (
        <div style={{ display: 'flex', fontSize: size, fontWeight: 800, color: won ? GREEN : MUTED }}>{sc ?? '—'}</div>
      )}
    </div>
  )
}

/** The centred "— VS —" divider between two teams. */
export function VersusDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ display: 'flex', height: 2, flexGrow: 1, backgroundColor: '#ded9cd' }} />
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#b8b3a6', letterSpacing: 4 }}>VS</div>
      <div style={{ display: 'flex', height: 2, flexGrow: 1, backgroundColor: '#ded9cd' }} />
    </div>
  )
}

/** A rounded info chip (date / venue / result note). */
export function Chip({ text, size = 34 }: { text: string; size?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        padding: '14px 30px',
        borderRadius: 999,
        backgroundColor: '#e7f4ec',
        color: '#0f5a30',
        fontSize: size,
        fontWeight: 800,
      }}
    >
      {text}
    </div>
  )
}

/** Solid trophy silhouette (Material "emoji_events"), so the champions card reads
 *  as silverware rather than a plain gold disc. Filled single path — satori
 *  rasterises it reliably. */
export function TrophyMark({ size = 72, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
    </svg>
  )
}
