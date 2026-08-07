import { kmBetween, parseNearParam, formatDistance } from '@/lib/platform/geo'

describe('kmBetween', () => {
  it('is ~0 for identical points', () => {
    expect(kmBetween(37.77, -122.42, 37.77, -122.42)).toBeCloseTo(0, 5)
  })

  it('approximates a known distance (SF ↔ NYC ≈ 4130 km)', () => {
    const d = kmBetween(37.7749, -122.4194, 40.7128, -74.006)
    expect(d).toBeGreaterThan(4000)
    expect(d).toBeLessThan(4200)
  })

  it('is symmetric', () => {
    const a = kmBetween(51.5, -0.12, 48.85, 2.35)
    const b = kmBetween(48.85, 2.35, 51.5, -0.12)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('parseNearParam', () => {
  it('parses valid "lat,lng"', () => {
    expect(parseNearParam('37.77,-122.42')).toEqual({ lat: 37.77, lng: -122.42 })
  })

  it('rejects malformed / out-of-range / missing values', () => {
    expect(parseNearParam(undefined)).toBeNull()
    expect(parseNearParam('')).toBeNull()
    expect(parseNearParam('37.77')).toBeNull()
    expect(parseNearParam('a,b')).toBeNull()
    expect(parseNearParam('91,0')).toBeNull() // lat out of range
    expect(parseNearParam('0,181')).toBeNull() // lng out of range
    expect(parseNearParam('1,2,3')).toBeNull()
    // Empty components must reject (Number('') === 0, not NaN).
    expect(parseNearParam('37.77,')).toBeNull()
    expect(parseNearParam(',')).toBeNull()
    expect(parseNearParam(',-122.42')).toBeNull()
  })
})

describe('formatDistance', () => {
  it('shows metres under 1 km', () => {
    expect(formatDistance(0.4)).toBe('400 m')
  })
  it('shows one decimal under 10 km', () => {
    expect(formatDistance(2.34)).toBe('2.3 km')
  })
  it('shows whole km up to the cap', () => {
    expect(formatDistance(42.6)).toBe('43 km')
    expect(formatDistance(600)).toBe('500+ km')
  })
  it('is empty for a non-finite / negative value', () => {
    expect(formatDistance(NaN)).toBe('')
    expect(formatDistance(-5)).toBe('')
  })
})
