import { NextResponse } from 'next/server'
import { getPlatformUser } from '@/lib/platform/auth-server'

// Free geocoding proxy (OpenStreetMap Nominatim) used to resolve a club's
// city/region/country to coordinates on save — no API key, no cost. Gated to a
// signed-in platform user so it can't be abused as an open proxy (which would
// risk our IP under Nominatim's usage policy: 1 req/s, User-Agent required, no
// bulk). Best-effort: any failure returns {} so the caller just skips coords.
export const dynamic = 'force-dynamic'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

export async function GET(request: Request) {
  const user = await getPlatformUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2 || q.length > 200) return NextResponse.json({}, { status: 400 })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: {
        // Nominatim requires an identifying User-Agent.
        'User-Agent': 'TossUp/1.0 (grassroots cricket community platform)',
        Accept: 'application/json',
      },
      signal: controller.signal,
      // Cache identical lookups for a day to stay well within the usage policy.
      next: { revalidate: 86400 },
    }).finally(() => clearTimeout(timer))

    if (!res.ok) return NextResponse.json({})
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
    const first = Array.isArray(data) ? data[0] : null
    const lat = Number(first?.lat)
    const lng = Number(first?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({})
    return NextResponse.json({ lat, lng }, { headers: { 'cache-control': 'private, max-age=3600' } })
  } catch {
    // Timeout / network / parse — geocoding is optional, don't surface an error.
    return NextResponse.json({})
  }
}
