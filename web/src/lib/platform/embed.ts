// Pure helper for the club embed widget. Kept free of client deps so it's
// unit-tested and shared; the caller supplies the origin (window.location.origin
// on the client).

/** Same-origin path to a club's embeddable microsite card. */
export function clubEmbedPath(slug: string): string {
  return `/embed/club/${encodeURIComponent(slug)}`
}

/** The `<iframe>` snippet a club pastes into their own website to embed their
 *  TossUp microsite card. `origin` is the deployment origin (no trailing slash
 *  required — normalised here). */
export function clubEmbedSnippet(origin: string, slug: string): string {
  const base = origin.replace(/\/+$/, '')
  const src = `${base}${clubEmbedPath(slug)}`
  return `<iframe src="${src}" width="100%" height="340" style="border:0;max-width:520px" loading="lazy" title="Club on TossUp"></iframe>`
}
