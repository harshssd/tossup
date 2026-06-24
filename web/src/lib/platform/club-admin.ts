'use client'

import { createPlatformBrowserClient } from './auth-browser'
import type { Club } from './queries'

// Club ownership + roster admin. Runs as the authenticated user so the Phase 5
// is_scope_admin RLS admits these writes; RLS (not these helpers) is the gate.

// clubs.slug is UNIQUE — append a short random suffix so duplicate club names
// don't collide (matches the prior createClub behavior).
function uniqueSlug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

/** Create a club owned by the current user: sets clubs.owner_id and adds an OWNER
 *  club_membership for the creator's self-Person. Requires sign-in. */
export async function createOwnedClub(input: Partial<Club> & { name: string }): Promise<Club> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in to register a club')

  const slug = uniqueSlug(input.name)
  const { data: club, error } = await supabase
    .from('clubs')
    .insert({ ...input, slug, owner_id: user.id })
    .select()
    .single()
  if (error) throw new Error(error.message)

  // OWNER membership via the creator's self-Person. owner_id already grants admin
  // via is_scope_admin, so a membership hiccup is non-fatal.
  const { data: prof } = await supabase.from('users').select('primary_person_id').eq('id', user.id).maybeSingle()
  if (prof?.primary_person_id) {
    const { error: mErr } = await supabase
      .from('club_memberships')
      .insert({ club_id: club.id, person_id: prof.primary_person_id, role: 'OWNER' })
    if (mErr) console.error('owner membership:', mErr.message)
  }
  return club as Club
}

/** Whether the current viewer is signed in and administers this club. */
export async function getClubAdminState(clubId: string): Promise<{ signedIn: boolean; isAdmin: boolean }> {
  const supabase = createPlatformBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { signedIn: false, isAdmin: false }
  const { data } = await supabase.rpc('is_scope_admin', { p_user: user.id, p_scope: 'club', p_scope_id: clubId })
  return { signedIn: true, isAdmin: data === true }
}

export interface RosterMember {
  id: string
  role: string
  personId: string
  name: string
}

const ROLE_ORDER: Record<string, number> = { OWNER: 0, ADMIN: 1, MODERATOR: 2, MEMBER: 3 }

/** Club roster: each membership with its Person's display name, strongest role first. */
export async function getClubRoster(clubId: string): Promise<RosterMember[]> {
  const supabase = createPlatformBrowserClient()
  const { data: mems, error } = await supabase
    .from('club_memberships')
    .select('id, role, person_id')
    .eq('club_id', clubId)
  if (error) throw new Error(error.message)
  const ids = (mems ?? []).map((m) => m.person_id)
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: people } = await supabase.from('player_profiles').select('id, display_name').in('id', ids)
    for (const p of people ?? []) names.set(p.id, p.display_name)
  }
  return (mems ?? [])
    .map((m) => ({ id: m.id, role: m.role, personId: m.person_id, name: names.get(m.person_id) ?? 'Unknown' }))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.name.localeCompare(b.name))
}

/** Add a roster member (creates an account-less Person). Admin-only + atomic via
 *  the add_club_member SECURITY DEFINER function. MEMBER or MODERATOR only. */
export async function addClubMember(clubId: string, displayName: string, role: 'MEMBER' | 'MODERATOR' = 'MEMBER'): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.rpc('add_club_member', {
    p_club_id: clubId,
    p_display_name: displayName,
    p_role: role,
  })
  if (error) throw new Error(error.message)
}

export type ClubRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER'

/** Change a member's role (admin-only via RLS). */
export async function setClubMemberRole(membershipId: string, role: ClubRole): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.from('club_memberships').update({ role }).eq('id', membershipId)
  if (error) throw new Error(error.message)
}

/** Remove a member (admin-only via RLS). */
export async function removeClubMember(membershipId: string): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.from('club_memberships').delete().eq('id', membershipId)
  if (error) throw new Error(error.message)
}
