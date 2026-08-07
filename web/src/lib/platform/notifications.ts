// Platform notifications — shared types + pure helpers (no client deps, so this
// is unit-testable and importable from both the bell and the client wrapper).

export type NotificationKind = 'CLUB_JOIN_APPROVED' | 'CLUB_JOIN_REJECTED' | 'EVENT_REMINDER' | 'GENERIC'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  link: string | null
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

/** Per-kind display metadata (clubhouse light). `dot` tints the row's marker. */
export const NOTIFICATION_META: Record<NotificationKind, { label: string; dot: string }> = {
  CLUB_JOIN_APPROVED: { label: 'Club', dot: '#1f9d57' },
  CLUB_JOIN_REJECTED: { label: 'Club', dot: '#9a978d' },
  EVENT_REMINDER: { label: 'Event', dot: '#2257b3' },
  GENERIC: { label: 'TossUp', dot: '#6f6c63' },
}

/** How many of these notifications are unread. Pure. */
export function unreadCount(list: AppNotification[]): number {
  return list.reduce((n, x) => n + (x.read_at ? 0 : 1), 0)
}

/** Badge text for an unread count: '' when zero, the number up to 9, then '9+'.
 *  Pure — keeps the badge from overflowing its pill. */
export function unreadBadge(count: number): string {
  if (count <= 0) return ''
  return count > 9 ? '9+' : String(count)
}
