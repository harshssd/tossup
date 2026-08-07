import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, Trophy, Megaphone, Compass, Heart } from 'lucide-react'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { getPlatformUser } from '@/lib/platform/auth-server'
import { buildHomeFeed } from '@/lib/platform/home-feed'
import { feedTimeLabel, type FeedItem } from '@/lib/platform/follows'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your feed — TossUp',
  description: 'Upcoming events, latest results, and announcements from the clubs and tournaments you follow.',
}

const TYPE_META: Record<FeedItem['type'], { icon: typeof CalendarDays; chip: string; label: string }> = {
  event: { icon: CalendarDays, chip: 'bg-[#e7f4ec] text-[#0f5a30]', label: 'Event' },
  result: { icon: Trophy, chip: 'bg-[#fcf3d6] text-[#9a6b09]', label: 'Result' },
  announcement: { icon: Megaphone, chip: 'bg-[#e4eefb] text-[#2257b3]', label: 'Announcement' },
}

function FeedRow({ item, now }: { item: FeedItem; now: number }) {
  const meta = TYPE_META[item.type]
  const Icon = meta.icon
  return (
    <Link
      href={item.sourceHref}
      className="cy-panel flex items-start gap-3 rounded-2xl border border-[#e7e4db] p-4 transition-colors hover:border-[#d8d4c8]"
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.chip}`}>
        <Icon className="h-4 w-4" aria-hidden />
        <span className="sr-only">{meta.label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-[#16150f]">{item.title}</p>
          <span className="shrink-0 text-xs text-[#9a978d]">{feedTimeLabel(item.ts, item.when, now)}</span>
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-[#6f6c63]">{item.sourceName}</p>
        {item.detail && <p className="mt-1 line-clamp-2 text-sm text-[#3a382f]">{item.detail}</p>}
      </div>
    </Link>
  )
}

function Section({ title, items, now }: { title: string; items: FeedItem[]; now: number }) {
  if (items.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="cy-display text-lg font-semibold text-[#16150f]">{title}</h2>
      <div className="mt-3 space-y-2.5">
        {items.map((item) => (
          <FeedRow key={item.key} item={item} now={now} />
        ))}
      </div>
    </section>
  )
}

function EmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="cy-panel mt-8 rounded-3xl border border-dashed border-[#d8d4c8] p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e7f4ec]">
        <Heart className="h-6 w-6 text-[#1f9d57]" aria-hidden />
      </span>
      <h2 className="cy-display mt-4 text-xl font-semibold text-[#16150f]">{heading}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#6f6c63]">{body}</p>
      <Link
        href="/discover"
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#1f9d57] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0f5a30]"
      >
        <Compass className="h-4 w-4" /> Explore clubs &amp; tournaments
      </Link>
    </div>
  )
}

export default async function HomeFeedPage() {
  const user = await getPlatformUser()
  // force-dynamic server component: renders once per request, so this is stable.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()

  return (
    <PlatformShell>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="cy-display text-4xl font-semibold text-[#16150f] sm:text-5xl">Your feed</h1>
        <p className="mt-2 text-sm text-[#6f6c63]">
          Everything happening at the clubs and tournaments you follow.
        </p>

        {!user ? (
          <EmptyState
            heading="Sign in to build your feed"
            body="Follow your local clubs and tournaments to get their upcoming events, results, and announcements in one place."
          />
        ) : (
          <FeedBody now={now} />
        )}
      </div>
    </PlatformShell>
  )
}

async function FeedBody({ now }: { now: number }) {
  const { upcoming, recent, followCount } = await buildHomeFeed(now)

  if (followCount === 0) {
    return (
      <EmptyState
        heading="You're not following anything yet"
        body="Tap Follow on any club or tournament page and it'll show up here — upcoming events, fresh results, and announcements."
      />
    )
  }

  if (upcoming.length === 0 && recent.length === 0) {
    return (
      <div className="cy-panel mt-8 rounded-3xl border border-[#e7e4db] p-8 text-center">
        <p className="text-sm text-[#6f6c63]">
          Nothing new from the {followCount} {followCount === 1 ? 'page' : 'pages'} you follow yet. Check back soon —
          new events, results, and announcements land here.
        </p>
      </div>
    )
  }

  return (
    <>
      <Section title="Upcoming" items={upcoming} now={now} />
      <Section title="Recent activity" items={recent} now={now} />
    </>
  )
}
