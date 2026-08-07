'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import { timeAgo } from '@/lib/platform/pavilion'
import { NOTIFICATION_META, unreadCount, unreadBadge, type AppNotification } from '@/lib/platform/notifications'
import { loadNotifications, markRead, markAllRead, subscribeToNotifications } from '@/lib/platform/notifications-client'

/** Header notification bell (platform chrome). Reads the signed-in user's
 *  notifications, shows an unread badge, live-updates via realtime, and marks
 *  read on open/click. Renders nothing when signed out. */
export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setItems(await loadNotifications())
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

  const unread = unreadCount(items)
  const badge = unreadBadge(unread)

  async function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) void refresh()
  }

  async function onItemClick(n: AppNotification) {
    setOpen(false)
    if (!n.read_at) {
      // Optimistic: flip locally, then persist (RLS scopes to the caller).
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      try {
        await markRead(n.id)
      } catch {
        void refresh()
      }
    }
  }

  async function onMarkAll() {
    setItems((xs) => xs.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })))
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
              {items.map((n) => {
                const meta = NOTIFICATION_META[n.kind]
                const row = (
                  <div className={`flex items-start gap-2.5 px-4 py-3 ${n.read_at ? '' : 'bg-[#f6faf7]'}`}>
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: n.read_at ? '#d8d4c8' : meta.dot }} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${n.read_at ? 'text-[#3a382f]' : 'font-semibold text-[#16150f]'}`}>{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-[#6f6c63]">{n.body}</p>}
                      <p className="mt-0.5 text-[11px] text-[#9a978d]">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )
                return (
                  <li key={n.id} className="border-b border-[#f2f0ea] last:border-0">
                    {n.link ? (
                      <Link href={n.link} onClick={() => onItemClick(n)} className="block hover:bg-[#faf9f6]">
                        {row}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => onItemClick(n)} className="block w-full text-left hover:bg-[#faf9f6]">
                        {row}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
