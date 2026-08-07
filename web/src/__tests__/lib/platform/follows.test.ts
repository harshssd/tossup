import { rankFeed, feedTimeLabel, MAX_FEED_PER_SECTION, type FeedItem } from '@/lib/platform/follows'

const NOW = 1_700_000_000_000

function item(over: Partial<FeedItem> & { key: string; when: FeedItem['when']; ts: number }): FeedItem {
  return {
    type: 'announcement',
    sourceName: 'Src',
    sourceHref: '/x',
    title: 'T',
    detail: null,
    ...over,
  }
}

describe('rankFeed', () => {
  it('splits items into upcoming and recent by their `when`', () => {
    const { upcoming, recent } = rankFeed(
      [
        item({ key: 'a', when: 'upcoming', ts: NOW + 1000 }),
        item({ key: 'b', when: 'recent', ts: NOW - 1000 }),
      ],
      NOW
    )
    expect(upcoming.map((i) => i.key)).toEqual(['a'])
    expect(recent.map((i) => i.key)).toEqual(['b'])
  })

  it('orders upcoming soonest-first and recent newest-first', () => {
    const { upcoming, recent } = rankFeed(
      [
        item({ key: 'later', when: 'upcoming', ts: NOW + 5000 }),
        item({ key: 'sooner', when: 'upcoming', ts: NOW + 1000 }),
        item({ key: 'old', when: 'recent', ts: NOW - 5000 }),
        item({ key: 'new', when: 'recent', ts: NOW - 1000 }),
      ],
      NOW
    )
    expect(upcoming.map((i) => i.key)).toEqual(['sooner', 'later'])
    expect(recent.map((i) => i.key)).toEqual(['new', 'old'])
  })

  it('dedupes by key (same post arriving via two fetches)', () => {
    const { recent } = rankFeed(
      [
        item({ key: 'post:1', when: 'recent', ts: NOW - 1000 }),
        item({ key: 'post:1', when: 'recent', ts: NOW - 1000 }),
      ],
      NOW
    )
    expect(recent).toHaveLength(1)
  })

  it('breaks ts ties deterministically by key', () => {
    const { recent } = rankFeed(
      [
        item({ key: 'zzz', when: 'recent', ts: NOW }),
        item({ key: 'aaa', when: 'recent', ts: NOW }),
      ],
      NOW
    )
    expect(recent.map((i) => i.key)).toEqual(['aaa', 'zzz'])
  })

  it('caps each section at MAX_FEED_PER_SECTION', () => {
    const many = Array.from({ length: MAX_FEED_PER_SECTION + 10 }, (_, i) =>
      item({ key: `r${i}`, when: 'recent', ts: NOW - i })
    )
    const { recent } = rankFeed(many, NOW)
    expect(recent).toHaveLength(MAX_FEED_PER_SECTION)
    // Newest kept, oldest dropped.
    expect(recent[0].key).toBe('r0')
  })
})

describe('feedTimeLabel', () => {
  it('formats future times as "in …" for upcoming', () => {
    expect(feedTimeLabel(NOW + 3 * 86_400_000, 'upcoming', NOW)).toBe('in 3d')
    expect(feedTimeLabel(NOW + 2 * 3_600_000, 'upcoming', NOW)).toBe('in 2h')
    expect(feedTimeLabel(NOW + 5 * 60_000, 'upcoming', NOW)).toBe('in 5m')
  })

  it('collapses imminent upcoming to "soon"', () => {
    expect(feedTimeLabel(NOW + 10_000, 'upcoming', NOW)).toBe('soon')
  })

  it('formats past times as "… ago" for recent', () => {
    expect(feedTimeLabel(NOW - 3 * 86_400_000, 'recent', NOW)).toBe('3d ago')
    expect(feedTimeLabel(NOW - 2 * 3_600_000, 'recent', NOW)).toBe('2h ago')
    expect(feedTimeLabel(NOW - 30_000, 'recent', NOW)).toBe('just now')
  })

  it('never goes negative when clocks skew', () => {
    // A "recent" ts slightly in the future clamps to just now, not a negative age.
    expect(feedTimeLabel(NOW + 5000, 'recent', NOW)).toBe('just now')
  })
})
