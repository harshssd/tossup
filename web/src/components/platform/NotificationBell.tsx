'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import { unreadBadge, type AppNotification } from '@/lib/platform/notifications'
import { loadNotifications, countUnread, markRead, markAllRead, subscribeToNotifications } from '@/lib/platform/notifications-client'
import { NotificationRow } from './NotificationRow'

/** Header notification bell (platform chrome). Reads the signed-in user's
 *  notifications, shows an unread badge, live-updates via realtime, and marks
 *  read on open/click. Renders nothing when signed out. */
export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<AppNotification[]>([])
  // Unread is tracked separately from `items` via an exact count query — the list
  // is capped at 20, so deriving the badge from it would undercount.
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [list, n] = await Promise.all([loadNotifications(), countUnread()])
      setItems(list)
      setUnread(n)
    } catch {
      // Non-fatal: the bell just stays empty if the fetch fails.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createPlatformBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      setUserId(user.id)
      void refresh()
    })
    return () => {
      cancelled = true
    }
  }, [refresh])

  // Live badge: refetch when a new notification arrives for this user.
  useEffect(() => {
    if (!userId) return
    return subscribeToNotifications(userId, () => void refresh())
  }, [userId, refresh])

  if (!userId) return null

  const badge = unreadBadge(unread)

  async function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) void refresh()
  }

  async function onItemClick(n: AppNotification) {
    setOpen(false)
    if (!n.read_at) {
      // Optimistic: flip locally + decrement the badge, then persist (RLS scopes
      // to the caller); revert by refetching on failure.
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      setUnread((u) => Math.max(0, u - 1))
      try {
        await markRead(n.id)
      } catch {
        void refresh()
      }
    }
  }

  async function onMarkAll() {
    setItems((xs) => xs.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })))
    setUnread(0)
    try {
      await markAllRead()
    } catch {
      void refresh()
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#6f6c63] transition-colors hover:bg-[#eef0ea] hover:text-[#16150f]"
        >
          <Bell className="h-[18px] w-[18px]" />
          {badge && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-[#c0431a] px-1 text-[10px] font-bold leading-4 text-white">
              {badge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-[#eceae3] px-4 py-2.5">
          <p className="cy-display text-sm font-semibold text-[#16150f]">Notifications</p>
          {unread > 0 && (
            <button type="button" onClick={onMarkAll} className="flex items-center gap-1 text-xs font-semibold text-[#0f5a30] hover:underline">
              <Check className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#9a978d]">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className="border-b border-[#f2f0ea] last:border-0">
                  <NotificationRow n={n} onSelect={onItemClick} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-[#eceae3] px-4 py-2.5 text-center text-xs font-semibold text-[#0f5a30] hover:bg-[#faf9f6]"
        >
          See all notifications
        </Link>
      </PopoverContent>
    </Popover>
  )
}
