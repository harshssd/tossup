// Anonymous, stable per-browser identity for the pre-auth era. Used so a viewer
// can acknowledge an announcement exactly once (UNIQUE(post_id, viewer_id) in the
// DB) without real auth. Replaced by the authenticated user id once auth lands.
const KEY = 'tossup-viewer-id'
const SEEN_KEY = 'tossup-pavilion-seen'

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

// Per-board "last seen" timestamp (epoch ms), so a returning viewer sees what's
// new since their last visit. Per-browser via localStorage; replaced by a
// server-side per-user read marker once auth lands.
export function getSeenAt(leagueId: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const v = window.localStorage.getItem(`${SEEN_KEY}:${leagueId}`)
    return v ? Number(v) : 0
  } catch {
    return 0
  }
}

export function setSeenAt(leagueId: string, ts: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${SEEN_KEY}:${leagueId}`, String(ts))
  } catch {
    // storage unavailable — "what's new" silently degrades to nothing-new
  }
}
