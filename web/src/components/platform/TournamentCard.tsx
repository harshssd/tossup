import Link from 'next/link'
import { MapPin, CalendarDays, Trophy } from 'lucide-react'
import { RecognitionBadge } from './RecognitionBadge'
import { TIER_META, type Tier } from '@/lib/platform/recognition'
import type { League } from '@/lib/platform/queries'

const REG_TONE: Record<string, string> = {
  OPEN: 'bg-[#e7f4ec] text-[#0f5a30]',
  CLOSED: 'bg-[#efede6] text-[#6f6c63]',
  UPCOMING: 'bg-[#fcf3d6] text-[#9a6b09]',
}

export function TournamentCard({ league, index = 0 }: { league: League; index?: number }) {
  const tier = league.recognition_tier as Tier
  const place = [league.city, league.region, league.country].filter(Boolean).join(', ') || league.venue
  return (
    <Link href={`/tournaments/${league.id}`} className="cy-rise block" style={{ animationDelay: `${index * 45}ms` }}>
      <div
        className="cy-card cy-shine cy-edge cy-panel h-full overflow-hidden rounded-2xl p-5"
        style={{ '--edge': TIER_META[tier].color } as React.CSSProperties}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0 text-[#bd8b1a]" />
            <h3 className="cy-display truncate text-[17px] font-bold text-[#16150f]">{league.name}</h3>
          </div>
          <RecognitionBadge tier={tier} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[#eef0ea] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6f6c63]">
            {league.type}
          </span>
          {league.format && (
            <span className="rounded-full bg-[#eef0ea] px-2 py-0.5 text-[10px] font-semibold text-[#6f6c63]">
              {league.format}
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${REG_TONE[league.registration_status] ?? ''}`}>
            {league.registration_status}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#8a877d]">
          {place && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {place}
            </span>
          )}
          {league.start_date && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {league.start_date}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
