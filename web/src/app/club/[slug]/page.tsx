import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Globe, Mail, UserPlus, CalendarDays, CalendarPlus, Trophy, Megaphone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RecognitionBadge } from '@/components/platform/RecognitionBadge'
import { TIER_META, roleLabel, type Tier } from '@/lib/platform/recognition'
import { getClubBySlug, countClubMembers } from '@/lib/platform/queries'
import { isServerScopeAdmin } from '@/lib/platform/auth-server'
import { platformDb } from '@/lib/platform/db'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { ShareButton } from '@/components/platform/ShareButton'
import { TrophyCabinet } from '@/components/platform/TrophyCabinet'
import { UpcomingEvents } from '@/components/platform/UpcomingEvents'
import { ClubAnnouncements } from '@/components/platform/ClubAnnouncements'
import { JoinClubButton } from '@/components/platform/JoinClubButton'
import { getViewerJoinState } from '@/lib/platform/club-join'
import { getClubHonors } from '@/lib/platform/honors'
import { getClubEvents } from '@/lib/platform/events'
import { listClubPosts, rankAnnouncements } from '@/lib/platform/pavilion'
import { formatPlace } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const club = await getClubBySlug(slug)
  if (!club) return { title: 'Club not found — TossUp' }

  const place = formatPlace(club, club.location)
  const title = `${club.name} — Cricket Club on TossUp`
  const description =
    club.description ||
    [`Cricket club${place ? ` in ${place}` : ''}`, club.is_recruiting ? 'recruiting players' : null]
      .filter(Boolean)
      .join(' · ') + ' — on TossUp, the home of grassroots cricket.'

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ClubProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const club = await getClubBySlug(slug)
  if (!club) notFound()

  const [members, { data: tournaments }, honors, events, announcements] = await Promise.all([
    countClubMembers(club.id),
    platformDb.from('leagues').select('id,name,registration_status,start_date').eq('club_id', club.id).eq('visibility', 'PUBLIC').limit(20),
    getClubHonors(club.id),
    getClubEvents(club.id),
    listClubPosts(club.id),
  ])

  const canManage = await isServerScopeAdmin('club', club.id)
  const isPublicClub = club.visibility === 'PUBLIC' || club.visibility === null
  // Admins don't request to join their own club; skip the extra reads for them.
  const joinState = !canManage && isPublicClub ? await getViewerJoinState(club.id) : null
  // Server component renders once (no client re-render), so this is stable.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  // Rank once here so the section header, count, feed, and empty-state CTA agree
  // on what's actually visible (ClubAnnouncements filters expired/non-announcement).
  const { pinned: pinnedAnn, feed: feedAnn } = rankAnnouncements(announcements, now)
  const visibleAnnouncements = pinnedAnn.length + feedAnn.length
  const place = formatPlace(club, club.location)
  const socials = (club.social_links ?? {}) as Record<string, string>
  // Re-validate the hex before it touches an inline style (the DB CHECK already
  // enforces it; this is defence-in-depth against any stale/bad value).
  const accent = club.accent_color && /^#[0-9a-fA-F]{6}$/.test(club.accent_color) ? club.accent_color : null

  return (
    <PlatformShell>
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/discover" className="text-xs font-semibold uppercase tracking-wider text-[#9a978d] hover:text-[#16150f]">
        ← Discover
      </Link>

      <div className="cy-hero mt-5 overflow-hidden rounded-3xl border border-[#e7e4db]">
        {accent && <div style={{ height: 4, backgroundColor: accent }} />}
        {club.cover_url && (
          <div className="relative h-40 w-full sm:h-52">
            <Image src={club.cover_url} alt={`${club.name} cover`} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" unoptimized />
          </div>
        )}
        <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            {club.crest_url && (
              <div
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 bg-white ${club.cover_url ? '-mt-14' : ''}`}
                style={{ borderColor: accent ?? '#e7e4db' }}
              >
                <Image src={club.crest_url} alt={`${club.name} crest`} fill sizes="64px" className="object-cover" unoptimized />
              </div>
            )}
            <div>
              <h1 className="cy-display text-4xl font-semibold text-[#16150f] sm:text-5xl">{club.name}</h1>
              {place && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-[#3a382f]">
                  <MapPin className="h-4 w-4" /> {place}
                </p>
              )}
              <p className="mt-2 text-xs text-[#6f6c63]">{TIER_META[club.recognition_tier as Tier]?.blurb}</p>
            </div>
          </div>
          <RecognitionBadge tier={club.recognition_tier as Tier} size="md" />
        </div>
        <ShareButton
          className="mt-5"
          title={`${club.name} — Cricket Club on TossUp`}
          text={[`${club.name} on TossUp`, place, club.is_recruiting ? 'recruiting players' : null].filter(Boolean).join(' · ')}
          path={`/club/${club.slug}`}
        />
        {canManage && (
          <Link href={`/club/${club.slug}/manage`} className="mt-5 inline-block">
            <Button size="sm" className="gap-1 bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
              <Settings className="h-4 w-4" /> Manage roster
            </Button>
          </Link>
        )}
        {joinState && (
          <JoinClubButton
            clubId={club.id}
            slug={club.slug ?? slug}
            signedIn={joinState.signedIn}
            isMember={joinState.isMember}
            requestStatus={joinState.requestStatus}
          />
        )}
        </div>
      </div>

      {club.description && <p className="mt-4 text-sm leading-relaxed text-foreground/90">{club.description}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{members} member{members === 1 ? '' : 's'}</span>
        {club.founded_year && <span>· Est. {club.founded_year}</span>}
        {club.website && (
          <a href={club.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#2257b3] hover:underline">
            <Globe className="h-4 w-4" /> Website
          </a>
        )}
        {club.contact_email && (
          <a href={`mailto:${club.contact_email}`} className="flex items-center gap-1 text-[#2257b3] hover:underline">
            <Mail className="h-4 w-4" /> Contact
          </a>
        )}
      </div>

      {Object.keys(socials).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(socials).map(([k, v]) => (
            <a key={k} href={v} target="_blank" rel="noreferrer">
              <Badge variant="outline" className="text-[11px] capitalize">{k}</Badge>
            </a>
          ))}
        </div>
      )}

      {club.is_recruiting && (
        <Card className="cy-panel mt-6 border-[#bfe3cc]">
          <CardContent className="p-4">
            <p className="flex items-center gap-2 font-semibold text-[#0f5a30]">
              <UserPlus className="h-4 w-4" /> Recruiting players
            </p>
            {club.roles_needed?.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Looking for: {club.roles_needed.map(roleLabel).join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(visibleAnnouncements > 0 || canManage) && (
        <section className="mt-8">
          <h2 className="cy-display flex items-center gap-2 text-lg font-semibold text-[#16150f]">
            <Megaphone className="h-5 w-5 text-[#1f9d57]" /> Announcements
            {visibleAnnouncements > 0 && <span className="text-[#9a978d]">({visibleAnnouncements})</span>}
          </h2>
          <ClubAnnouncements posts={announcements} now={now} />
          {visibleAnnouncements === 0 && canManage && (
            <Link
              href={`/club/${club.slug}/manage`}
              className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-[#d8d4c8] px-4 py-3 text-sm font-semibold text-[#0f5a30] hover:border-[#1f9d57]"
            >
              <Megaphone className="h-4 w-4" /> Post your club&apos;s first announcement →
            </Link>
          )}
        </section>
      )}

      {(events.length > 0 || canManage) && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="cy-display flex items-center gap-2 text-lg font-semibold text-[#16150f]">
              <CalendarDays className="h-5 w-5 text-[#1f9d57]" /> Upcoming events
              {events.length > 0 && <span className="text-[#9a978d]">({events.length})</span>}
            </h2>
            {events.length > 0 && (
              <a
                href={`/api/clubs/${club.id}/events.ics`}
                aria-label="Download upcoming events as a calendar file (.ics)"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0f5a30] hover:underline"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
              </a>
            )}
          </div>
          <UpcomingEvents events={events} slug={slug} />
          {events.length === 0 && canManage && (
            <Link
              href={`/club/${club.slug}/manage`}
              className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-[#d8d4c8] px-4 py-3 text-sm font-semibold text-[#0f5a30] hover:border-[#1f9d57]"
            >
              <CalendarDays className="h-4 w-4" /> Schedule your club&apos;s first practice or match →
            </Link>
          )}
        </section>
      )}

      <TrophyCabinet honors={honors} />
      {honors.length === 0 && canManage && (
        <Link
          href={`/club/${club.slug}/manage`}
          className="mt-8 flex items-center gap-2 rounded-2xl border border-dashed border-[#d8d4c8] px-4 py-3 text-sm font-semibold text-[#0f5a30] hover:border-[#1f9d57]"
        >
          <Trophy className="h-4 w-4" /> Add your club&apos;s first trophy →
        </Link>
      )}

      <h2 className="mt-8 text-lg font-semibold">Tournaments</h2>
      <div className="mt-2 space-y-2">
        {(tournaments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No tournaments yet.</p>}
        {(tournaments ?? []).map((t) => (
          <Link key={t.id} href={`/tournaments/${t.id}`}>
            <Card className="cy-panel hover:border-[#d8d4c8]">
              <CardContent className="flex items-center justify-between p-4">
                <span className="font-medium">{t.name}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  {t.start_date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {t.start_date}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[11px]">{t.registration_status}</Badge>
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
    </PlatformShell>
  )
}
