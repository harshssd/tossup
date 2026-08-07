'use client'

import { createPlatformBrowserClient } from './auth-browser'
import type { FollowScope } from './follows'

// Follow / unfollow mutations for the authed browser client. RLS is the gate
// (follows_self_* policies): you can only insert your own follow to a PUBLIC
// scope, and only delete your own row.

/** Follow a PUBLIC club or tournament. Idempotent: a duplicate hits the
 *  UNIQUE(user_id, scope, scope_id) constraint, which we treat as already-followed
 *  rather than an error (two rapid taps shouldn't surface a failure). */
export async function followScope(scope: FollowScope, scopeId: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to follow')
  const { error } = await supabase.from('follows').insert({ user_id: user.id, scope, scope_id: scopeId })
  // 23505 = unique_violation → already following, not a real error.
  if (error && error.code !== '23505') throw new Error(error.message)
}

/** Unfollow: remove the viewer's own follow row (no-op if it isn't there). */
export async function unfollowScope(scope: FollowScope, scopeId: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in')
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('user_id', user.id)
    .eq('scope', scope)
    .eq('scope_id', scopeId)
  if (error) throw new Error(error.message)
}

/** Toggle in one call; returns the resulting follow state. */
export async function setFollow(scope: FollowScope, scopeId: string, follow: boolean): Promise<boolean> {
  if (follow) await followScope(scope, scopeId)
  else await unfollowScope(scope, scopeId)
  return follow
}
