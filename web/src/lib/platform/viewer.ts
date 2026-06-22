// Anonymous, stable per-browser identity for the pre-auth era. Used so a viewer
// can acknowledge an announcement exactly once (UNIQUE(post_id, viewer_id) in the
// DB) without real auth. Replaced by the authenticated user id once auth lands.
const KEY = 'tossup-viewer-id'

export function getViewerId(): string {
  if (typeof window === 'undefined') return ''
  // localStorage can throw (Safari private mode, storage disabled). Never let
  // that crash the caller — this runs in a render-phase useState initializer.
  try {
    let id = window.localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return ''
  }
}
