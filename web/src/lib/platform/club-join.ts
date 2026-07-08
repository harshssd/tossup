import { createPlatformServerClient } from './auth-server'
import type { JoinRequestStatus } from './club-join-client'

// Server-side read of the current viewer's relationship to a club, used to pick
// the right join affordance on the public club page.

export type { JoinRequestStatus }

export interface ViewerJoinState {
  signedIn: boolean
  isMember: boolean
  requestStatus: JoinRequestStatus | null
}

export async function getViewerJoinState(clubId: string): Promise<ViewerJoinState> {
  const supabase = await createPlatformServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { signedIn: false, isMember: false, requestStatus: null }

  const [{ data: isMember }, { data: req }] = await Promise.all([
    supabase.rpc('is_club_member', { p_user: user.id, p_club: clubId }),
    supabase
      .from('club_join_requests')
      .select('status')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    signedIn: true,
    isMember: isMember === true,
    requestStatus: req?.status ?? null,
  }
}
