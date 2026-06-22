import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, CalendarDays, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RecognitionBadge } from '@/components/platform/RecognitionBadge'
import { StandingsTable } from '@/components/platform/StandingsTable'
import { MatchCard } from '@/components/platform/MatchCard'
import { Pavilion } from '@/components/platform/Pavilion'
import { type Tier } from '@/lib/platform/recognition'
import { getTournament } from '@/lib/platform/queries'
import { PlatformShell } from '@/components/platform/PlatformShell'

export const dynamic = 'force-dynamic'

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { league, teams, fixtures, standings } = await getTournament(id)
  if (!league) notFound()

  const place = [league.city, league.region, league.country].filter(Boolean).join(', ') || league.venue

  return (
    <PlatformShell>
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/discover?tab=tournaments" className="text-xs font-semibold uppercase tracking-wider text-[#9a978d] hover:text-[#16150f]">
        ← Discover
      </Link>

      <div className="cy-hero mt-5 overflow-hidden rounded-3xl border border-[#e7e4db] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#3a382f]">
              {league.type} · {league.format || 'Tournament'}
            </p>
            <h1 className="cy-display max-w-xl text-4xl font-semibold text-[#16150f] sm:text-5xl">{league.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#3a382f]">
              <Badge className="border-0 bg-[#eef0ea] text-[11px] text-[#16150f] backdrop-blur">{league.registration_status}</Badge>
              {place && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {place}
                </span>
              )}
              {league.start_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> {league.start_date}
                  {league.end_date ? ` – ${league.end_date}` : ''}
                </span>
              )}
            </div>
          </div>
          <RecognitionBadge tier={league.recognition_tier as Tier} size="md" />
        </div>
        {league.description && <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#3a382f]">{league.description}</p>}
        <Link href={`/tournaments/${league.id}/manage`} className="mt-5 inline-block">
          <Button size="sm" className="gap-1 bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
            <Settings className="h-4 w-4" /> Manage tournament
          </Button>
        </Link>
      </div>

      <div className="mt-8">
        <Pavilion leagueId={league.id} mode="public" />
      </div>

      <h2 className="cy-display mt-10 text-2xl font-semibold text-[#16150f]">Standings</h2>
      <div className="mt-2">
        <StandingsTable rows={standings} />
      </div>

      <h2 className="cy-display mt-10 text-2xl font-semibold text-[#16150f]">Fixtures &amp; results</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fixtures.length === 0 && <p className="text-sm text-[#9a978d]">No fixtures scheduled.</p>}
        {fixtures.map((fx, i) => (
          <MatchCard key={fx.id} fixture={fx} index={i} />
        ))}
      </div>

      <h2 className="cy-display mt-10 text-2xl font-semibold text-[#16150f]">Teams ({teams.length})</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {teams.map((t) => (
          <Badge key={t.id} variant="outline" className="text-xs">{t.name}</Badge>
        ))}
      </div>
    </div>
    </PlatformShell>
  )
}
