/** Path to the generated 1080×1080 result-card PNG for a completed fixture.
 *  Server-rendered by /api/share/fixture/[id] (public tournaments only). */
export function fixtureCardImagePath(fixtureId: string): string {
  return `/api/share/fixture/${fixtureId}`
}

/** A filesystem-safe filename for a shared result card (no extension). */
export function shareCardFilename(a: string | null, b: string | null): string {
  const slug = `${a || 'team-a'}-vs-${b || 'team-b'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'result'}-tossup`
}
