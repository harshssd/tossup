import { fixtureCardImagePath, shareCardFilename } from '@/lib/platform/share'

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
