import { unreadCount, unreadBadge, NOTIFICATION_META, type AppNotification } from '@/lib/platform/notifications'

function n(over: Partial<AppNotification>): AppNotification {
  return {
    id: 'n1',
    kind: 'GENERIC',
    title: 'T',
    body: null,
    link: null,
    data: {},
    read_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('unreadCount', () => {
  it('counts only unread (read_at null) notifications', () => {
    expect(unreadCount([n({ read_at: null }), n({ read_at: '2026-01-02T00:00:00Z' }), n({ read_at: null })])).toBe(2)
    expect(unreadCount([])).toBe(0)
  })
})

describe('unreadBadge', () => {
  it('is empty for zero/negative', () => {
    expect(unreadBadge(0)).toBe('')
    expect(unreadBadge(-3)).toBe('')
  })
  it('shows the number up to 9, then 9+', () => {
    expect(unreadBadge(1)).toBe('1')
    expect(unreadBadge(9)).toBe('9')
    expect(unreadBadge(10)).toBe('9+')
    expect(unreadBadge(250)).toBe('9+')
  })
})

describe('NOTIFICATION_META', () => {
  it('has an entry for every kind', () => {
    for (const k of ['CLUB_JOIN_APPROVED', 'CLUB_JOIN_REJECTED', 'EVENT_REMINDER', 'GENERIC'] as const) {
      expect(NOTIFICATION_META[k]).toBeTruthy()
      expect(NOTIFICATION_META[k].dot).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
