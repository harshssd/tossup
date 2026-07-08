'use client'

import { createPlatformBrowserClient } from './auth-browser'

// Club join requests — authed client mutations + the admin reader. RLS is the
// gate (cjr_* policies + the decide/list SECURITY DEFINER functions).

export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** Ask to join a PUBLIC club (RLS: own PENDING request, not already a member). */
export async function requestToJoin(clubId: string, message?: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in')
  const { error } = await supabase
    .from('club_join_requests')
    .insert({ club_id: clubId, user_id: user.id, message: message?.trim() || null })
  if (error) throw new Error(error.message)
}

/** Withdraw your own pending request. */
export async function withdrawJoinRequest(clubId: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in')
  const { error } = await supabase
    .from('club_join_requests')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'PENDING')
  if (error) throw new Error(error.message)
}

export interface JoinRequest {
  id: string
  user_id: string
  requester_name: string
  message: string | null
  created_at: string
}

/** Admin-only pending-request list (via the definer function). */
export async function loadJoinRequests(clubId: string): Promise<JoinRequest[]> {
  const supabase = createPlatformBrowserClient()
  const { data, error } = await supabase.rpc('list_club_join_requests', { p_club_id: clubId })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Approve (→ MEMBER) or reject a request (admin-only via the definer function). */
export async function decideJoinRequest(requestId: string, approve: boolean): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.rpc('decide_club_join_request', { p_request_id: requestId, p_approve: approve })
  if (error) throw new Error(error.message)
}
