// Phase E3: follows + /home feed — pure helpers (types, ranking, labels). No
// DB/server imports here so this stays unit-testable; the server aggregator that
// reads the DB lives in home-feed.ts and consumes rankFeed().

export type FollowScope = 'club' | 'league'

/** A normalised item in a user's home feed. `ts` (ms since epoch) is the single
 *  sort axis; `when` splits the timeline into a forward-looking section and a
 *  backward-looking one so a future event and a past result never fight over the
 *  same ordering. `key` is stable per source row → dedup + React key. */
export interface FeedItem {
  key: string
  type: 'event' | 'result' | 'announcement'
  when: 'upcoming' | 'recent'
  ts: number
  sourceName: string
  sourceHref: string
  title: string
  detail: string | null
}

/** The viewer's relationship to a followable scope, resolved server-side and
 *  handed to <FollowButton> so it renders without a mount round-trip. */
export interface ViewerFollowState {
  signedIn: boolean
  following: boolean
  followerCount: number
}

// Per-section cap: the feed is a glanceable digest, not an archive. Applied after
// sort so we keep the most relevant items (soonest upcoming / newest recent).
export const MAX_FEED_PER_SECTION = 30

/** Split a flat item list into the two feed sections and order each: upcoming
 *  soonest-first (what's next), recent newest-first (what just happened). Dedupes
 *  by `key` (the same post can arrive via both a club and league fetch), and
 *  `key` is the deterministic tie-breaker so equal-`ts` items don't flicker
 *  between renders. Pure — unit-tested. */
export function rankFeed(items: FeedItem[], now: number = Date.now()): { upcoming: FeedItem[]; recent: FeedItem[] } {
  const byKey = new Map<string, FeedItem>()
  for (const it of items) byKey.set(it.key, it)
  const deduped = [...byKey.values()]

  const upcoming = deduped
    .filter((i) => i.when === 'upcoming')
    .sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key))
    .slice(0, MAX_FEED_PER_SECTION)

  const recent = deduped
    .filter((i) => i.when === 'recent')
    .sort((a, b) => b.ts - a.ts || a.key.localeCompare(b.key))
    .slice(0, MAX_FEED_PER_SECTION)

  // Ignore `now` for the split itself — an item's `when` is decided by whoever
  // builds it (an event is upcoming, a result is recent); `now` stays part of the
  // signature so a future "expire stale upcoming" tweak needs no call-site churn.
  void now
  return { upcoming, recent }
}

/** Compact relative-time label: forward for upcoming ("in 3d", "in 2h", "soon"),
 *  backward for recent ("3d ago", "just now"). Pure — unit-tested. */
export function feedTimeLabel(ts: number, when: 'upcoming' | 'recent', now: number = Date.now()): string {
  const diff = when === 'upcoming' ? ts - now : now - ts
  const s = Math.max(0, Math.floor(diff / 1000))
  const suffix = when === 'upcoming' ? '' : ' ago'
  const prefix = when === 'upcoming' ? 'in ' : ''
  if (s < 60) return when === 'upcoming' ? 'soon' : 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${prefix}${m}m${suffix}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${prefix}${h}h${suffix}`
  const d = Math.floor(h / 24)
  return `${prefix}${d}d${suffix}`
}
