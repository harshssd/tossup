import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Mail, Phone, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RecognitionBadge } from '@/components/platform/RecognitionBadge'
import { roleLabel, type Tier } from '@/lib/platform/recognition'
import { getPlayer } from '@/lib/platform/queries'
import { PlatformShell } from '@/components/platform/PlatformShell'

export const dynamic = 'force-dynamic'

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const player = await getPlayer(id)
  if (!player) notFound()
  // A merged-away Person redirects to the canonical survivor.
  if (player.merged_into_id) redirect(`/player/${player.merged_into_id}`)

  const place = [player.city, player.region, player.country].filter(Boolean).join(', ')

  return (
    <PlatformShell>
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/discover?tab=players" className="text-xs font-semibold uppercase tracking-wider text-[#9a978d] hover:text-[#16150f]">
        ← Discover
      </Link>

      <div className="cy-hero mt-5 overflow-hidden rounded-3xl border border-[#e7e4db] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="cy-display text-4xl font-semibold text-[#16150f] sm:text-5xl">{player.display_name}</h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#3a382f]">{roleLabel(player.primary_role)}</p>
          </div>
          <RecognitionBadge tier={player.recognition_tier as Tier} size="md" />
        </div>
      </div>

      {player.looking_for_club && (
        <Badge className="mt-3 gap-1 bg-[#e7f4ec] text-[#0f5a30]">
          <Search className="h-3 w-3" /> Looking for a club
        </Badge>
      )}

      {player.bio && <p className="mt-4 text-sm leading-relaxed text-foreground/90">{player.bio}</p>}

      <Card className="cy-panel mt-6">
        <CardContent className="grid grid-cols-2 gap-4 p-5 text-sm">
          <Field label="Batting" value={player.batting_style} />
          <Field label="Bowling" value={player.bowling_style} />
          <Field label="Availability" value={player.availability} />
          <Field label="Location" value={place || null} />
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {place && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-4 w-4" /> {place}
          </span>
        )}
        {player.contact_email && (
          <a href={`mailto:${player.contact_email}`} className="flex items-center gap-1 text-[#2257b3] hover:underline">
            <Mail className="h-4 w-4" /> Email
          </a>
        )}
        {player.contact_phone && (
          <a href={`tel:${player.contact_phone}`} className="flex items-center gap-1 text-[#2257b3] hover:underline">
            <Phone className="h-4 w-4" /> Call
          </a>
        )}
      </div>
    </div>
    </PlatformShell>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value || '—'}</p>
    </div>
  )
}
