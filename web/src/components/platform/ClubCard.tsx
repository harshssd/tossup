import Link from 'next/link'
import { MapPin, UserPlus } from 'lucide-react'
import { RecognitionBadge } from './RecognitionBadge'
import { roleLabel, TIER_META, type Tier } from '@/lib/platform/recognition'
import type { Club } from '@/lib/platform/queries'

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function ClubCard({ club, index = 0 }: { club: Club; index?: number }) {
  const tier = club.recognition_tier as Tier
  const place = [club.city, club.region, club.country].filter(Boolean).join(', ') || club.location
  return (
    <Link href={`/club/${club.slug}`} className="cy-rise block" style={{ animationDelay: `${index * 45}ms` }}>
      <div
        className="cy-card cy-shine cy-edge cy-panel h-full overflow-hidden rounded-2xl p-5"
        style={{ '--edge': TIER_META[tier].color } as React.CSSProperties}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1f9d57] text-sm font-extrabold text-white">
              {initials(club.name)}
            </span>
            <div className="min-w-0">
              <h3 className="cy-display truncate text-[17px] font-bold text-[#16150f]">{club.name}</h3>
              {place && (
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-[#8a877d]">
                  <MapPin className="h-3.5 w-3.5" />
                  {place}
                </p>
              )}
            </div>
          </div>
          <RecognitionBadge tier={tier} />
        </div>
        {club.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[#6f6c63]">{club.description}</p>
        )}
        {club.is_recruiting && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdeee4] px-2.5 py-1 text-xs font-bold text-[#b8531f]">
              <UserPlus className="h-3.5 w-3.5" />
              Recruiting{club.roles_needed?.length ? ` · ${club.roles_needed.map(roleLabel).join(', ')}` : ''}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
