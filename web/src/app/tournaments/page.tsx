import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { DiscoverFilters } from '@/components/platform/DiscoverFilters'
import { TournamentCard } from '@/components/platform/TournamentCard'
import { listTournaments } from '@/lib/platform/queries'
import type { Tier } from '@/lib/platform/recognition'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tournaments — TossUp',
  description:
    'Browse cricket tournaments and leagues — open registrations, live standings, and results, from local turf to recognized leagues.',
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const tournaments = await listTournaments({
    q: sp.q,
    country: sp.country,
    region: sp.region,
    tier: sp.tier as Tier | undefined,
    status: sp.status,
  })

  return (
    <PlatformShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="cy-hero overflow-hidden rounded-[1.75rem] px-6 py-9 sm:px-10 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#e7f4ec] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f5a30]">
                <span className="cy-pulse h-1.5 w-1.5 rounded-full bg-[#1f9d57]" /> Tournaments
              </span>
              <h1 className="cy-display mt-4 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
                <span className="text-[#16150f]">Find a league.</span>
                <br />
                <span className="cy-grad-text">Enter your team.</span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-[#6f6c63]">
                Open registrations, fixtures, and live standings — or host your own tournament in
                minutes.
              </p>
            </div>
            <Link
              href="/tournaments/new"
              className="flex items-center gap-1.5 rounded-full bg-[#1f9d57] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_-10px_rgba(31,157,87,0.7)] transition-transform hover:scale-[1.03]"
            >
              <Plus className="h-4 w-4" /> Host tournament
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <DiscoverFilters tab="tournaments" basePath="/tournaments" />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#9a978d]">
          {tournaments.length} {tournaments.length === 1 ? 'result' : 'results'}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((l, i) => (
            <TournamentCard key={l.id} league={l} index={i} />
          ))}
        </div>

        {tournaments.length === 0 && (
          <div className="mt-20 text-center">
            <p className="text-sm text-[#8a877d]">Nothing here yet.</p>
            <Link href="/tournaments/new" className="mt-2 inline-block font-bold text-[#1f9d57] hover:underline">
              Host tournament →
            </Link>
          </div>
        )}
      </div>
    </PlatformShell>
  )
}
