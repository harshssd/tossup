import nextConfig from '../../next.config'

// Guards the Phase F legacy-route retirement (updated for the 2026-08 audit
// purge): retired surfaces redirect to platform equivalents, but the auction
// product's operational deep routes (/leagues/create, /leagues/[id]/dashboard)
// must NOT be redirected — a blanket /leagues/* redirect once dead-ended auction
// creation (?league=<id> → /auction/create). /clubs/* is now fully redirected
// because ALL its legacy pages were deleted (the auction flow needs only
// /leagues/*; club management lives on the platform).

type Redirect = { source: string; destination: string; permanent: boolean }

async function getRedirects(): Promise<Redirect[]> {
  const r = await nextConfig.redirects!()
  return r as Redirect[]
}

describe('legacy-route redirects', () => {
  it('retires the index/discovery + landing surfaces', async () => {
    const map = new Map((await getRedirects()).map((r) => [r.source, r.destination]))
    expect(map.get('/explore')).toBe('/discover')
    expect(map.get('/explore/club/:slug*')).toBe('/discover?tab=clubs')
    expect(map.get('/clubs/:path*')).toBe('/discover?tab=clubs')
    expect(map.get('/leagues')).toBe('/tournaments')
    expect(map.get('/tournament/:path+')).toBe('/tournaments')
    expect(map.get('/dashboard')).toBe('/home')
    expect(map.get('/admin')).toBe('/home')
  })

  it('does NOT redirect the auction operational deep routes (leagues only)', async () => {
    const sources = (await getRedirects()).map((r) => r.source)
    // A blanket /leagues wildcard would swallow the auction's league plumbing.
    expect(sources).not.toContain('/leagues/:path*')
    expect(sources).not.toContain('/leagues/create')
    const deep = ['/leagues/create', '/leagues/abc/dashboard']
    for (const path of deep) {
      const hit = sources.find((s) => s === path)
      expect(hit).toBeUndefined()
    }
  })

  it('the singular /tournament redirect cannot swallow /tournaments', async () => {
    // `:path+` requires at least one segment under /tournament, and the source
    // segment is exactly "tournament" — /tournaments is a different segment.
    const sources = (await getRedirects()).map((r) => r.source)
    expect(sources).toContain('/tournament/:path+')
    expect(sources).not.toContain('/tournaments/:path*')
    expect(sources).not.toContain('/tournament')
  })

  it('no redirect target is itself a redirect source (no loop)', async () => {
    const redirects = await getRedirects()
    const sources = new Set(redirects.map((r) => r.source))
    for (const r of redirects) {
      const destPath = r.destination.split('?')[0]
      expect(sources.has(destPath)).toBe(false)
    }
  })
})
