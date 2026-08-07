import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { MapPin, UserPlus, ArrowUpRight } from 'lucide-react'
import { getClubBySlug, countClubMembers } from '@/lib/platform/queries'
import { TIER_META, type Tier } from '@/lib/platform/recognition'
import { isValidHexColor } from '@/lib/platform/club-branding'
import { formatPlace } from '@/lib/platform/format'

// The embeddable club microsite card — a compact, self-contained view a club
// pastes into their own website via <iframe>. No app chrome (PlatformShell) and
// framing is allowed for this path only (see next.config headers). Anon read →
// PUBLIC clubs only (a private club 404s).
export const dynamic = 'force-dynamic'

// Don't index the bare widget as a duplicate of the real club page.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function ClubEmbed({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const club = await getClubBySlug(slug)
  if (!club) notFound()

  const members = await countClubMembers(club.id)
  const place = formatPlace(club, club.location)
  const tier = club.recognition_tier as Tier
  const accent = club.accent_color && isValidHexColor(club.accent_color) ? club.accent_color : null
  const href = `/club/${club.slug ?? slug}`

  return (
    <div className="clubhouse cy-ground min-h-screen p-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative mx-auto flex max-w-lg flex-col overflow-hidden rounded-2xl border border-[#e7e4db] bg-white no-underline shadow-[0_10px_40px_-24px_rgba(20,21,15,0.5)]"
      >
        {accent && <div style={{ height: 4, backgroundColor: accent }} />}
        {club.cover_url && (
          <div className="relative h-24 w-full">
            <Image src={club.cover_url} alt="" fill sizes="520px" className="object-cover" unoptimized />
          </div>
        )}
        <div className="flex items-start gap-3 p-4">
          {club.crest_url && (
            <div
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 bg-white ${club.cover_url ? '-mt-10' : ''}`}
              style={{ borderColor: accent ?? '#e7e4db' }}
            >
              <Image src={club.crest_url} alt={`${club.name} crest`} fill sizes="56px" className="object-contain p-0.5" unoptimized />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h1 className="cy-display truncate text-lg font-semibold text-[#16150f]">{club.name}</h1>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: `${TIER_META[tier]?.color}22`, color: TIER_META[tier]?.color }}
              >
                {TIER_META[tier]?.label}
              </span>
            </div>
            {place && (
              <p className="mt-1 flex items-center gap-1 text-xs text-[#6f6c63]">
                <MapPin className="h-3.5 w-3.5" /> {place}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6f6c63]">
              <span>
                {members} member{members === 1 ? '' : 's'}
              </span>
              {club.is_recruiting && (
                <span className="flex items-center gap-1 rounded-full bg-[#e7f4ec] px-2 py-0.5 font-semibold text-[#0f5a30]">
                  <UserPlus className="h-3 w-3" /> Recruiting
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[#f0eee7] px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9a978d]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#c1121f]" /> Powered by TossUp
          </span>
          <span className="flex items-center gap-1 text-xs font-bold text-[#0f5a30] group-hover:underline">
            View club <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </a>
    </div>
  )
}
