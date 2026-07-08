'use client'

import { createPlatformBrowserClient } from './auth-browser'
import { listClubPosts, type Post, type PostKind, type PostPriority } from './pavilion'

// Club Pavilion writes (v1 = admin announcements board). Authed — club admins
// only; RLS (posts_club_admin_*) is the gate. Unlike the tournament pavilion,
// there is no anon write path for club posts.

export interface NewClubAnnouncement {
  clubId: string
  kind: PostKind
  priority: PostPriority
  title?: string | null
  body: string
  isPinned?: boolean
  expiresAt?: string | null
}

/** Authed read for the manage screen (sees a PRIVATE club's board). */
export function loadClubPostsAdmin(clubId: string): Promise<Post[]> {
  return listClubPosts(clubId, createPlatformBrowserClient())
}

/** Post a club announcement. Admin-only via RLS (author_id must be the caller). */
export async function createClubAnnouncement(input: NewClubAnnouncement): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in')
  const { error } = await supabase.from('tournament_posts').insert({
    club_id: input.clubId,
    kind: input.kind,
    priority: input.priority,
    title: input.title?.trim() || null,
    body: input.body,
    author_id: user.id,
    is_host: true,
    is_pinned: input.isPinned ?? false,
    pinned_at: input.isPinned ? new Date().toISOString() : null,
    expires_at: input.expiresAt ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Pin / unpin a club announcement (admin-only via RLS). */
export async function setClubPostPinned(id: string, pinned: boolean): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase
    .from('tournament_posts')
    .update({ is_pinned: pinned, pinned_at: pinned ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Delete a club announcement (admin-only via RLS). */
export async function deleteClubPost(id: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.from('tournament_posts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
