import { platformDb } from './db'
import type { PlayerProfile } from './queries'

// Person operations. A Person (player_profiles row) is a roster identity that
// may or may not be linked to a User account. Link is M:1 — a user owns many
// Persons; each Person has <= 1 user (player_profiles.user_id).
//
// NOTE: admin-of-scope authority for these mutations is enforced by RLS once
// memberships land (Phase 2) + the RLS rewrite (Phase 4). Today the platform is
// anon-permissive, so these run unguarded — consistent with the rest of the app.

/** Link a Person to a User account. Only attaches an *unlinked*, live Person —
 *  re-assigning a Person already owned by another user is a distinct transfer/
 *  merge operation (Phase 3/5), not a silent overwrite here. */
export async function linkPersonToUser(personId: string, userId: string): Promise<void> {
  const { error } = await platformDb
    .from('player_profiles')
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', personId)
    .is('merged_into_id', null)
    .is('user_id', null)
  if (error) throw new Error(error.message)
}

/** Unlink a Person from its User account (clears the M:1 link). */
export async function unlinkPerson(personId: string): Promise<void> {
  const { error } = await platformDb
    .from('player_profiles')
    .update({ user_id: null, updated_at: new Date().toISOString() })
    .eq('id', personId)
  if (error) throw new Error(error.message)
}

/** Merge two Person records (same human). Re-points all references to the
 *  winner, dedupes membership collisions, tombstones the loser; blocks if they
 *  link to different users. Delegates to the SECURITY DEFINER merge_persons()
 *  (advisory-locked, idempotent). Destructive — gate behind admin confirmation.
 *  NOTE: merge_persons is REVOKEd from anon/authenticated (service_role only)
 *  until Phase 5 adds an in-function caller-authority check; call this from a
 *  trusted server route with the service-role client, not the anon platformDb. */
export async function mergePersons(loserId: string, winnerId: string): Promise<void> {
  const { error } = await platformDb.rpc('merge_persons', { p_loser: loserId, p_winner: winnerId })
  if (error) throw new Error(error.message)
}

/** Live Persons owned by a user — their self-Person plus any roster identities
 *  they manage. Excludes tombstoned (merged-away) Persons. */
export async function getPersonsForUser(userId: string): Promise<PlayerProfile[]> {
  const { data, error } = await platformDb
    .from('player_profiles')
    .select('*')
    .eq('user_id', userId)
    .is('merged_into_id', null)
    .order('created_at', { ascending: true })
  if (error) console.error('getPersonsForUser:', error.message)
  return data ?? []
}
