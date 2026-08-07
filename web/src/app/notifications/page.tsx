'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import { PlatformShell } from '@/components/platform/PlatformShell'
import { Button } from '@/components/ui/button'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import { unreadCount, type AppNotification } from '@/lib/platform/notifications'
import { loadNotifications, markRead, markAllRead } from '@/lib/platform/notifications-client'
import { NotificationRow } from '@/components/platform/NotificationRow'

// Full notification history (the bell caps at 20). Client-gated to the platform
// user — /notifications is public in middleware so this gate runs (a signed-out
// visitor sees the sign-in prompt rather than being bounced to the legacy auth).
export default function NotificationsInboxPage() {
  const [status, setStatus] = useState<'loading' | 'guest' | 'ready'>('loading')
  const [items, setItems] = useState<AppNotification[]>([])

  const refresh = useCallback(async () => {
    // Swallow its own error so callers (including failure-path fallbacks) never
    // produce a dangling rejection; on failure we just keep the current list.
    try {
      setItems(await loadNotifications(100))
    } catch {
      /* keep current items */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createPlatformBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return
      if (!user) {
        setStatus('guest')
        return
      }
      try {
        await refresh()
      } catch {
        // non-fatal — show an empty inbox rather than crash
      }
      if (!cancelled) setStatus('ready')
    })
    return () => {
      cancelled = true
    }
  }, [refresh])

  function onSelect(n: AppNotification) {
    if (n.read_at) return
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
    markRead(n.id).catch(() => void refresh())
  }

  async function onMarkAll() {
    setItems((xs) => xs.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })))
    try {
      await markAllRead()
    } catch {
      void refresh()
    }
  }

  const unread = unreadCount(items)

  return (
    <PlatformShell>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="cy-display text-3xl font-semibold text-[#16150f] sm:text-4xl">Notifications</h1>
          {status === 'ready' && unread > 0 && (
            <Button size="sm" variant="outline" onClick={onMarkAll} className="gap-1.5">
              <Check className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        {status === 'loading' && <p className="mt-8 text-center text-sm text-[#9a978d]">Loading…</p>}

        {status === 'guest' && (
          <div className="cy-panel mt-8 rounded-2xl border border-dashed border-[#d8d4c8] p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e7f4ec]">
              <Bell className="h-6 w-6 text-[#1f9d57]" aria-hidden />
            </span>
            <h2 className="cy-display mt-4 text-xl font-semibold text-[#16150f]">Sign in to see your notifications</h2>
            <Link
              href="/account/sign-in?redirect=/notifications"
              className="mt-5 inline-flex rounded-full bg-[#1f9d57] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0f5a30]"
            >
              Sign in
            </Link>
          </div>
        )}

        {status === 'ready' &&
          (items.length === 0 ? (
            <div className="cy-panel mt-8 rounded-2xl border border-[#e7e4db] p-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e7f4ec]">
                <Bell className="h-6 w-6 text-[#1f9d57]" aria-hidden />
              </span>
              <p className="mt-4 text-sm text-[#6f6c63]">You&apos;re all caught up — no notifications yet.</p>
            </div>
          ) : (
            <ul className="cy-panel mt-6 divide-y divide-[#f2f0ea] overflow-hidden rounded-2xl border border-[#e7e4db]">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationRow n={n} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          ))}
      </div>
    </PlatformShell>
  )
}
