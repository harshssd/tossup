import {
  fixtureCardImagePath,
  shareCardFilename,
  championsCardImagePath,
  championsCardFilename,
  formatMatchDate,
} from '@/lib/platform/share'

describe('fixtureCardImagePath', () => {
  it('points at the fixture card image route', () => {
    expect(fixtureCardImagePath('abc-123')).toBe('/api/share/fixture/abc-123')
  })
})

describe('shareCardFilename', () => {
  it('slugifies both team names into a tossup-suffixed filename', () => {
    expect(shareCardFilename('Sidewinders CC', 'Bay Blasters')).toBe('sidewinders-cc-vs-bay-blasters-tossup')
  })

  it('handles nulls and punctuation without leaving stray separators', () => {
    expect(shareCardFilename(null, "St. George's XI")).toBe('team-a-vs-st-george-s-xi-tossup')
    expect(shareCardFilename('', '')).toBe('team-a-vs-team-b-tossup')
  })
})

describe('championsCardImagePath', () => {
  it('points at the champions card image route', () => {
    expect(championsCardImagePath('league-9')).toBe('/api/share/champions/league-9')
  })
})

describe('championsCardFilename', () => {
  it('slugifies the champion name with a champions-tossup suffix', () => {
    expect(championsCardFilename('Sidewinders CC')).toBe('sidewinders-cc-champions-tossup')
  })

  it('falls back to a generic name when the champion is null/blank', () => {
    expect(championsCardFilename(null)).toBe('champions-tossup')
    expect(championsCardFilename('   ')).toBe('champions-tossup')
  })
})

describe('formatMatchDate', () => {
  it('formats an ISO timestamp as a UTC date label', () => {
    // 2026-07-12 is a Sunday in UTC.
    expect(formatMatchDate('2026-07-12T14:30:00Z')).toBe('Sun 12 Jul 2026')
  })

  it('uses the UTC calendar day regardless of the offset in the string', () => {
    // 23:30-05:00 is 04:30Z the NEXT day → the UTC date wins.
    expect(formatMatchDate('2026-07-12T23:30:00-05:00')).toBe('Mon 13 Jul 2026')
  })

  it('returns null for a missing or unparseable date', () => {
    expect(formatMatchDate(null)).toBeNull()
    expect(formatMatchDate('not-a-date')).toBeNull()
  })
})
