'use client'

import { createPlatformBrowserClient } from './auth-browser'
import type { PlayerProfile } from './queries'
import type { ProfileEditableFields } from './onboarding'

/** Create a player profile owned by the current user (sets user_id = self so the
 *  creator can edit it later). Requires sign-in — player_profiles INSERT is now
 *  RLS-gated to authenticated callers creating their own Person. */
export async function createOwnedPlayerProfile(
  input: Partial<PlayerProfile> & { display_name: string }
): Promise<PlayerProfile> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to list a player profile')
  const { data, error } = await supabase
    .from('player_profiles')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PlayerProfile
}

/** Update fields on a profile the current user owns (RLS pp_owner_update: user_id
 *  = self). Limited to user-editable columns — trust/recognition columns are
 *  excluded from the type and enforced by a DB guard trigger. */
export async function updateOwnedProfile(personId: string, fields: ProfileEditableFields): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in')
  const { error } = await supabase.from('player_profiles').update(fields).eq('id', personId)
  if (error) throw new Error(error.message)
}
