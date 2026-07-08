// Display formatters shared across platform pages, their generateMetadata, and
// their OG image routes. Centralized so the place/date format can't drift
// between the three renders of the same entity.

/** "City, Region, Country", falling back to an entity-specific field (club
 *  location / tournament venue) when no geo parts are set. Null when empty. */
export function formatPlace(
  loc: { city?: string | null; region?: string | null; country?: string | null },
  fallback?: string | null
): string | null {
  return [loc.city, loc.region, loc.country].filter(Boolean).join(', ') || fallback || null
}

/** "start – end", or just "start" when there's no end. Null when no start. */
export function formatDateRange(start?: string | null, end?: string | null): string | null {
  if (!start) return null
  return end ? `${start} – ${end}` : start
}
