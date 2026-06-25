import { platformDb } from './db'
import type { PlayerProfile } from './queries'

// Person operations. A Person (player_profiles row) is a roster identity that
// may or may not be linked to a User account. Link is M:1 — a user owns many
// Persons; each Person has <= 1 user (player_profiles.user_id).
//
// NOTE: admin-of-scope authority for these mutations is enforced by RLS once
// memberships land (Phase 2) + the RLS rewrite (Phase 4). Today the platform is
// anon-permissive, so these run unguarded — consistent with the rest of the app.

// Person<->User link/unlink removed: they ran unguarded on the anon platformDb
// (a footgun) and were unused. player_profiles writes are now RLS-gated to the
// owner; "link a player to a user" is realized by merging an account-less roster
// Person into the user's account-Person (admin-gated merge_persons). A dedicated
// admin link op, if needed, should be a SECURITY DEFINER function with an
// is_scope_admin authority check — not an anon client write.

// Person merge lives in lib/platform/club-admin.ts (mergeMembers) — Phase 5b
// added an in-function caller-authority check to merge_persons and re-granted it
// to authenticated, so it must be called via the authed client (not the anon
// platformDb, which is REVOKEd and would always fail).

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
