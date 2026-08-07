import { postAuthDestination } from '@/lib/auth-redirect'

describe('postAuthDestination', () => {
  it('honors a safe relative redirect param', () => {
    expect(postAuthDestination('?redirect=/auctions')).toBe('/auctions')
    expect(postAuthDestination('?redirect=%2Fleagues%2Fabc%2Fdashboard')).toBe('/leagues/abc/dashboard')
  })

  it('falls back to /home when absent', () => {
    expect(postAuthDestination('')).toBe('/home')
    expect(postAuthDestination('?foo=bar')).toBe('/home')
  })

  it('rejects absolute and protocol-relative URLs (open-redirect guard)', () => {
    expect(postAuthDestination('?redirect=https://evil.com')).toBe('/home')
    expect(postAuthDestination('?redirect=//evil.com')).toBe('/home')
    expect(postAuthDestination('?redirect=javascript:alert(1)')).toBe('/home')
  })

  it('honors a custom fallback', () => {
    expect(postAuthDestination('', '/discover')).toBe('/discover')
  })
})
