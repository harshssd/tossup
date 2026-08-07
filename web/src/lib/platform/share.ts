/** Path to the generated 1080×1080 card PNG for a fixture. The route branches on
 *  the fixture's status: a COMPLETED fixture renders a result card, a SCHEDULED
 *  one a "match announced" card (public tournaments only). */
export function fixtureCardImagePath(fixtureId: string): string {
  return `/api/share/fixture/${fixtureId}`
}

/** Path to the generated 1080×1080 champions card for a concluded tournament.
 *  Server-rendered by /api/share/champions/[leagueId] (public tournaments only). */
export function championsCardImagePath(leagueId: string): string {
  return `/api/share/champions/${leagueId}`
}

/** A filesystem-safe filename (no extension) for a shared champions card. */
export function championsCardFilename(championName: string | null): string {
  const slug = (championName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `${slug}-champions-tossup` : 'champions-tossup'
}

/** Date-only label (UTC, deterministic across server locales) for a fixture's
 *  scheduled date on the "match announced" card, e.g. "Sat 12 Jul 2026". Returns
 *  null for a missing/unparseable date so the card can omit the line. */
export function formatMatchDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
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
