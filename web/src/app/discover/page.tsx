import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { DiscoverFilters } from '@/components/platform/DiscoverFilters'
import { ClubCard } from '@/components/platform/ClubCard'
import { PlayerCard } from '@/components/platform/PlayerCard'
import { TournamentCard } from '@/components/platform/TournamentCard'
import { listClubs, listPlayers, listTournaments } from '@/lib/platform/queries'
import type { Tier } from '@/lib/platform/recognition'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Discover — TossUp',
  description:
    'Discover cricket clubs, players, and tournaments near you — ranked by recognition, from your local turf to the big leagues.',
}

type Tab = 'clubs' | 'players' | 'tournaments'
const TABS: { key: Tab; label: string }[] = [
  { key: 'clubs', label: 'Clubs' },
  { key: 'players', label: 'Players' },
  { key: 'tournaments', label: 'Tournaments' },
]
const TICKER = ['Find your club', 'Recruit players', 'Host a tournament', 'Live standings', 'Recognized results', 'Grassroots → Official']

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const tab: Tab = (['clubs', 'players', 'tournaments'].includes(sp.tab ?? '') ? sp.tab : 'clubs') as Tab
  const common = { q: sp.q, country: sp.country, region: sp.region }

  const [clubs, players, tournaments] = await Promise.all([
    tab === 'clubs' ? listClubs({ ...common, tier: sp.tier as Tier | undefined, recruiting: !!sp.recruiting }) : [],
    tab === 'players' ? listPlayers({ ...common, role: sp.role, lookingForClub: !!sp.looking }) : [],
    tab === 'tournaments' ? listTournaments({ ...common, tier: sp.tier as Tier | undefined, status: sp.status }) : [],
  ])

  const createHref = tab === 'clubs' ? '/club/new' : tab === 'players' ? '/player/new' : '/tournaments/new'
  const createLabel = tab === 'clubs' ? 'Add club' : tab === 'players' ? 'Add profile' : 'Host tournament'
  const count = tab === 'clubs' ? clubs.length : tab === 'players' ? players.length : tournaments.length

  return (
    <PlatformShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Hero */}
        <div className="cy-hero overflow-hidden rounded-[1.75rem] px-6 py-9 sm:px-10 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#e7f4ec] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f5a30]">
                <span className="cy-pulse h-1.5 w-1.5 rounded-full bg-[#1f9d57]" /> The cricket community
              </span>
              <h1 className="cy-display mt-4 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
                <span className="text-[#16150f]">Find your club.</span>
                <br />
                <span className="text-[#16150f]">Play more </span>
                <span className="cy-grad-text">cricket.</span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-[#6f6c63]">
                Discover clubs, players, and tournaments near you — ranked by recognition, from your
                local turf to the big leagues.
              </p>
            </div>
            <Link
              href={createHref}
              className="flex items-center gap-1.5 rounded-full bg-[#1f9d57] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-10px_rgba(31,157,87,0.7)] transition-transform hover:scale-[1.03]"
            >
              <Plus className="h-4 w-4" /> {createLabel}
            </Link>
          </div>
          <div className="mt-9 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
            <div className="cy-marquee text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a877d]">
              {Array.from({ length: 2 }).map((_, k) => (
                <span key={k} className="inline-flex gap-10">
                  {TICKER.map((t) => (
                    <span key={t} className="inline-flex items-center gap-2.5">
                      <span className="h-1 w-1 rounded-full bg-[#1f9d57]" /> {t}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 border-b border-[#e7e4db]">
          {TABS.map((t) => {
            const params = new URLSearchParams()
            params.set('tab', t.key)
            const active = tab === t.key
            return (
              <Link
                key={t.key}
                href={`/discover?${params.toString()}`}
                className={cn(
                  'relative px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors',
                  active ? 'text-[#16150f]' : 'text-[#9a978d] hover:text-[#16150f]'
                )}
              >
                {t.label}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#1f9d57]" />}
              </Link>
            )
          })}
        </div>

        <div className="mt-6">
          <DiscoverFilters tab={tab} />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#9a978d]">
          {count} {count === 1 ? 'result' : 'results'}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tab === 'clubs' && clubs.map((c, i) => <ClubCard key={c.id} club={c} index={i} />)}
          {tab === 'players' && players.map((p, i) => <PlayerCard key={p.id} player={p} index={i} />)}
          {tab === 'tournaments' && tournaments.map((l, i) => <TournamentCard key={l.id} league={l} index={i} />)}
        </div>

        {count === 0 && (
          <div className="mt-20 text-center">
            <p className="text-sm text-[#8a877d]">Nothing here yet.</p>
            <Link href={createHref} className="mt-2 inline-block font-bold text-[#1f9d57] hover:underline">
              {createLabel} →
            </Link>
          </div>
        )}
      </div>
    </PlatformShell>
  )
}
