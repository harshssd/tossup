import { platformDb } from './db'

export type Scope = 'club' | 'team' | 'league' | 'tournament_team'

/** True if the user administers the given scope (OWNER/ADMIN membership, or the
 *  club/league owner). Delegates to the SECURITY DEFINER `is_scope_admin()` so
 *  app code and (Phase 4) RLS policies share one authority definition and avoid
 *  membership-table RLS recursion. */
export async function isScopeAdmin(userId: string, scope: Scope, scopeId: string): Promise<boolean> {
  const { data, error } = await platformDb.rpc('is_scope_admin', {
    p_user: userId,
    p_scope: scope,
    p_scope_id: scopeId,
  })
  if (error) {
    console.error('isScopeAdmin:', error.message)
    return false
  }
  return data === true
}
