/** Resolve the post-authentication destination from a URL search string. Honors a
 *  safe RELATIVE `?redirect=` param (the middleware sets it when bouncing an
 *  unauthenticated user off a protected route, e.g. /auth/signin?redirect=/auctions),
 *  otherwise the platform home feed. Absolute or protocol-relative values
 *  (`https://…`, `//evil.com`) are rejected to avoid an open redirect. Pure. */
export function postAuthDestination(search: string, fallback = '/home'): string {
  let value: string | null = null
  try {
    value = new URLSearchParams(search).get('redirect')
  } catch {
    return fallback
  }
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return fallback
}
