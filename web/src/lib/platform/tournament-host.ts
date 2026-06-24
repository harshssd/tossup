'use client'

import { createPlatformBrowserClient } from './auth-browser'
import type { League } from './queries'

// Tournament hosting with real ownership. These run as the *authenticated* user
// (not the anon platformDb), so owner_id / memberships are set as the creator and
// is_scope_admin resolves correctly.

/** Create a tournament owned by the current user: sets leagues.owner_id and adds
 *  an OWNER league_membership for the creator's self-Person. Requires sign-in. */
export async function createOwnedTournament(input: Partial<League> & { name: string }): Promise<League> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to host a tournament')

  const { data: league, error } = await supabase
    .from('leagues')
    .insert({ ...input, owner_id: user.id })
    .select()
    .single()
  if (error) throw new Error(error.message)

  // OWNER membership via the creator's self-Person. owner_id already grants admin
  // via is_scope_admin, so a membership hiccup is non-fatal.
  const { data: prof } = await supabase.from('users').select('primary_person_id').eq('id', user.id).maybeSingle()
  if (prof?.primary_person_id) {
    const { error: mErr } = await supabase
      .from('league_memberships')
      .insert({ league_id: league.id, person_id: prof.primary_person_id, role: 'OWNER' })
    if (mErr) console.error('owner membership:', mErr.message)
  }
  return league as League
}

/** Whether the current viewer is signed in and administers this tournament. */
export async function getTournamentAdminState(leagueId: string): Promise<{ signedIn: boolean; isAdmin: boolean }> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { signedIn: false, isAdmin: false }
  const { data } = await supabase.rpc('is_scope_admin', { p_user: user.id, p_scope: 'league', p_scope_id: leagueId })
  return { signedIn: true, isAdmin: data === true }
}
