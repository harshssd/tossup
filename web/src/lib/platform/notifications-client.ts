'use client'

import { createPlatformBrowserClient } from './auth-browser'
import type { AppNotification } from './notifications'

// Authed-browser reads/mutations for the notification bell. RLS is the gate
// (notif_self_* policies): a user only ever sees/updates their own rows.

export async function loadNotifications(limit = 20): Promise<AppNotification[]> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as AppNotification[]
}

/** Accurate unread count for the badge — a `head:true` count over the partial
 *  index, so it's correct even when unread rows sit beyond the fetched list page. */
export async function countUnread(): Promise<number> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Mark one notification read. Idempotent (`.is('read_at', null)` skips already-read
 *  rows); RLS scopes it to the caller's own row regardless. */
export async function markRead(id: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  if (error) throw new Error(error.message)
}

/** Mark all of the caller's unread notifications read. */
export async function markAllRead(): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (error) throw new Error(error.message)
}

/** Live-update the bell: fire `onInsert` when a new notification lands for this
 *  user. Realtime respects RLS, so the filter only ever matches the caller's rows.
 *  Returns an unsubscribe fn. */
export function subscribeToNotifications(userId: string, onInsert: () => void): () => void {
  const supabase = createPlatformBrowserClient()
  const channel = supabase
    .channel(`notifs:${userId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      onInsert
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
