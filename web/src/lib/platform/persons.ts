import { platformDb } from './db'
import type { PlayerProfile } from './queries'

// Person operations. A Person (player_profiles row) is a roster identity that
// may or may not be linked to a User account. Link is M:1 — a user owns many
// Persons; each Person has <= 1 user (player_profiles.user_id).
//
// NOTE: admin-of-scope authority for these mutations is enforced by RLS once
// memberships land (Phase 2) + the RLS rewrite (Phase 4). Today the platform is
// anon-permissive, so these run unguarded — consistent with the rest of the app.

/** Link a Person to a User account. Won't link a tombstoned (merged-away) Person. */
export async function linkPersonToUser(personId: string, userId: string): Promise<void> {
  const { error } = await platformDb
    .from('player_profiles')
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', personId)
    .is('merged_into_id', null)
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
