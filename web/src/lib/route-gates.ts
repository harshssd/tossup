// Pure route-gating rules shared by the middleware and its regression tests.
// Extracted after the 2026-08 audit: two one-line mistakes here silently killed
// shipped features (U1: /start missing from the public list bounced the landing
// page's primary CTA to the legacy auction login; U5: an empty geolocation
// allow-list blocked the app's own "clubs near me" prompt).

/** `geolocation=(self)` is REQUIRED — navigator.geolocation powers clubs-near-me,
 *  and an empty allow-list `()` blocks the document itself (no prompt, ever). */
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(self), payment=()'

/** Routes the LEGACY auth gate must never bounce to /auth/signin. Platform pages
 *  here render their own platform sign-in gates client-side. */
export function isPublicRoute(pathname: string): boolean {
  // Exact-match routes (no subroutes; a prefix would over-match /homework etc.)
  if (pathname === '/') return true
  if (pathname === '/home') return true
  if (pathname === '/notifications') return true
  if (pathname === '/api/geocode') return true
  // The onboarding wizard — the landing page's PRIMARY CTA.
  if (pathname === '/start') return true
  // Public pricing page (transparent-pricing strategy; no subroutes).
  if (pathname === '/pricing') return true
  // Crawler metadata — crawlers are ALWAYS anonymous; without these the whole
  // SEO pack 307s to the sign-in page (review: the U1 failure mode, again).
  if (pathname === '/sitemap.xml') return true
  if (pathname === '/robots.txt') return true

  // Prefix-match routes (all subpaths are public)
  const publicPrefixes = [
    '/auth/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/live',
    '/tournament',
    // Platform (community/discovery) public surfaces. Trailing slashes on
    // /club/ and /player/ avoid exposing the legacy /clubs dashboard route.
    '/discover',
    '/club/',
    '/player/',
    // The embeddable club widget is anonymous (iframed on third-party sites).
    '/embed/',
    '/account',
    '/api/health',
    '/api/auth',
  ]

  return (
    publicPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.includes('/public/') ||
    pathname.includes('/_next/') ||
    pathname.includes('/favicon.ico')
  )
}
