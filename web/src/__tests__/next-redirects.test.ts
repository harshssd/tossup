import nextConfig from '../../next.config'

// Guards the Phase F legacy-route retirement: the INDEX/discovery surfaces
// redirect to platform equivalents, but the auction product's operational deep
// routes (/leagues/create, /leagues/[id]/dashboard, /clubs/create, /clubs/[id]/*)
// must NOT be redirected — a blanket /leagues/* redirect once dead-ended auction
// creation (?league=<id> → /auction/create). Locks that in.

type Redirect = { source: string; destination: string; permanent: boolean }

async function getRedirects(): Promise<Redirect[]> {
  const r = await nextConfig.redirects!()
  return r as Redirect[]
}

describe('Phase F legacy-route redirects', () => {
  it('retires the index/discovery + landing surfaces', async () => {
    const map = new Map((await getRedirects()).map((r) => [r.source, r.destination]))
    expect(map.get('/explore')).toBe('/discover')
    expect(map.get('/explore/club/:slug*')).toBe('/discover?tab=clubs')
    expect(map.get('/clubs')).toBe('/discover?tab=clubs')
    expect(map.get('/leagues')).toBe('/tournaments')
    expect(map.get('/dashboard')).toBe('/home')
    expect(map.get('/admin')).toBe('/home')
  })

  it('does NOT redirect the auction operational deep routes', async () => {
    const sources = (await getRedirects()).map((r) => r.source)
    // A blanket wildcard here would swallow the auction's league/club plumbing.
    expect(sources).not.toContain('/leagues/:path*')
    expect(sources).not.toContain('/clubs/:path*')
    expect(sources).not.toContain('/leagues/create')
    expect(sources).not.toContain('/clubs/create')
    // No source matches a deep auction route.
    const deep = ['/leagues/create', '/leagues/abc/dashboard', '/clubs/create', '/clubs/abc/dashboard']
    for (const path of deep) {
      const hit = sources.find((s) => s === path)
      expect(hit).toBeUndefined()
    }
  })

  it('no redirect target is itself a redirect source (no loop)', async () => {
    const redirects = await getRedirects()
    const sources = new Set(redirects.map((r) => r.source))
    for (const r of redirects) {
      // Compare on the path portion (ignore any query string on the destination).
      const destPath = r.destination.split('?')[0]
      expect(sources.has(destPath)).toBe(false)
    }
  })
})
