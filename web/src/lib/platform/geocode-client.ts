'use client'

// Client wrapper over the /api/geocode proxy. Best-effort: returns null on any
// failure so callers (e.g. club create) proceed without coordinates.
export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim()
  if (q.length < 2) return null
  try {
    // Cap the wait so a stalled request never blocks club creation (the route is
    // itself best-effort; on timeout we just proceed without coords).
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    )
    if (!res.ok) return null
    const data = (await res.json()) as { lat?: number; lng?: number }
    if (typeof data.lat === 'number' && typeof data.lng === 'number') {
      return { lat: data.lat, lng: data.lng }
    }
    return null
  } catch {
    return null
  }
}
