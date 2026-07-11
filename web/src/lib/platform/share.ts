/** Path to the generated 1080×1080 result-card PNG for a completed fixture.
 *  Server-rendered by /api/share/fixture/[id] (public tournaments only). */
export function fixtureCardImagePath(fixtureId: string): string {
  return `/api/share/fixture/${fixtureId}`
}

/** Cricket innings score `runs/wkts (overs)`, or null when no runs are recorded.
 *  Shared by the on-page MatchCard and the shared result-card image so the two
 *  can't drift. */
export function formatCricketScore(r: number | null, w: number | null, o: number | null): string | null {
  if (r == null) return null
  return `${r}/${w ?? 0}${o != null ? ` (${o})` : ''}`
}

/** A filesystem-safe filename for a shared result card (no extension). */
export function shareCardFilename(a: string | null, b: string | null): string {
  const slug = `${a || 'team-a'}-vs-${b || 'team-b'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'result'}-tossup`
}
