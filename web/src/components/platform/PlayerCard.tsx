import Link from 'next/link'
import { MapPin, Search } from 'lucide-react'
import { RecognitionBadge } from './RecognitionBadge'
import { initials, roleLabel, TIER_META, toTier } from '@/lib/platform/recognition'
import type { PlayerProfile } from '@/lib/platform/queries'

const ROLE_COLOR: Record<string, string> = {
  BATSMAN: '#e07a44',
  BOWLER: '#1f9d57',
  ALL_ROUNDER: '#2f7df6',
  WICKETKEEPER: '#bd8b1a',
}

export function PlayerCard({ player, index = 0 }: { player: PlayerProfile; index?: number }) {
  const tier = toTier(player.recognition_tier)
  const place = [player.city, player.region, player.country].filter(Boolean).join(', ')
  const color = (player.primary_role && ROLE_COLOR[player.primary_role]) || '#6f6c63'
  return (
    <Link href={`/player/${player.id}`} className="cy-rise block" style={{ animationDelay: `${index * 45}ms` }}>
      <div
        className="cy-card cy-shine cy-edge cy-panel h-full overflow-hidden rounded-2xl p-5"
        style={{ '--edge': TIER_META[tier].color } as React.CSSProperties}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-extrabold text-white"
              style={{ background: color }}
            >
              {initials(player.display_name)}
            </span>
            <div className="min-w-0">
              <h3 className="cy-display truncate text-[17px] font-bold text-[#16150f]">{player.display_name}</h3>
              <p className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-[#8a877d]">
                {roleLabel(player.primary_role)}
              </p>
            </div>
          </div>
          <RecognitionBadge tier={tier} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {place && (
            <span className="flex items-center gap-1 text-[#8a877d]">
              <MapPin className="h-3.5 w-3.5" />
              {place}
            </span>
          )}
          {player.looking_for_club && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f4ec] px-2.5 py-1 font-bold text-[#0f5a30]">
              <Search className="h-3.5 w-3.5" />
              Looking for a club
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
