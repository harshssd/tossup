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
  // Must be a single-origin relative path. Beyond the `//` protocol-relative
  // form, WHATWG URL parsing treats backslash as slash for http(s), so
  // `/\evil.com` would resolve cross-origin — reject backslashes and control
  // characters outright (2026-08 audit review).
  if (value && /^\/(?![/\\])/.test(value) && !/[\\\n\r\t]/.test(value)) return value
  return fallback
}
