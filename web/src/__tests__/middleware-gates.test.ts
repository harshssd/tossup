import { isPublicRoute, PERMISSIONS_POLICY } from '@/lib/route-gates'

// Regression guards from the 2026-08 audit: two one-line middleware mistakes
// silently killed shipped features (U1: /start bounced to the legacy auction
// login; U5: the Permissions-Policy header blocked the app's own geolocation).

describe('isPublicRoute', () => {
  it('keeps the platform self-gating pages out of the legacy auth bounce', () => {
    for (const p of ['/', '/start', '/home', '/notifications', '/api/geocode', '/pricing', '/sitemap.xml', '/robots.txt']) {
      expect(isPublicRoute(p)).toBe(true)
    }
  })

  it('keeps public platform surfaces public', () => {
    for (const p of ['/discover', '/club/sidewinders', '/player/abc', '/tournaments', '/embed/club/x', '/account/sign-in']) {
      expect(isPublicRoute(p)).toBe(true)
    }
  })

  it('still gates the legacy auction surfaces', () => {
    for (const p of ['/auctions', '/auction/create', '/captain/x', '/bid/x', '/clubs/abc/dashboard', '/leagues/create']) {
      expect(isPublicRoute(p)).toBe(false)
    }
  })

  it('does not over-match exact routes', () => {
    expect(isPublicRoute('/startup')).toBe(false)
    expect(isPublicRoute('/homework')).toBe(false)
  })
})

describe('PERMISSIONS_POLICY', () => {
  it('allows self geolocation (clubs-near-me depends on it) and keeps the rest locked', () => {
    expect(PERMISSIONS_POLICY).toContain('geolocation=(self)')
    expect(PERMISSIONS_POLICY).toContain('camera=()')
    expect(PERMISSIONS_POLICY).toContain('microphone=()')
    expect(PERMISSIONS_POLICY).toContain('payment=()')
  })
})
