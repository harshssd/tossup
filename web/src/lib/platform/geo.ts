// Pure geo helpers for the "clubs near me" mode. The DB orders results via the
// km_between() SQL helper; kmBetween() here is a matching haversine used only for
// the per-card distance label, so the displayed distance agrees with the order.

/** Great-circle distance in km between two lat/lng points (haversine, R=6371). */
export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Parse a `?near=lat,lng` param into validated coords, or null if malformed /
 *  out of range (so a bad/injected value falls back to the normal listing). */
export function parseNearParam(value: string | undefined | null): { lat: number; lng: number } | null {
  if (!value) return null
  const parts = value.split(',')
  if (parts.length !== 2) return null
  // Reject empty components — Number('') is 0, which would silently resolve
  // "37.77," to {lat:37.77, lng:0} instead of falling back to the normal listing.
  if (parts[0].trim() === '' || parts[1].trim() === '') return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

/** Human-friendly distance label: metres under 1 km, one decimal under 10 km,
 *  whole km up to a cap. Empty for a non-finite/negative value. */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  if (km > 500) return '500+ km'
  return `${Math.round(km)} km`
}
