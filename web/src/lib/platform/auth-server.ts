import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

// Server-side auth client for the platform project (tossup-cricket). Reads/writes
// the platform session cookies. Use in server components, route handlers, and
// (later) API routes that need the authenticated platform user.
export async function createPlatformServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component — middleware refreshes the session instead.
          }
        },
      },
    }
  )
}

export interface PlatformUser {
  id: string
  email: string | null
  name: string | null
  /** The user's canonical self-Person (player_profiles.id). How "the current
   *  user's own Person" is resolved for authorship / independent-user flows. */
  primaryPersonId: string | null
}

/** The authenticated platform user (with their self-Person), or null. Verified
 *  against the auth server via getUser() — never trusts an unverified cookie. */
export async function getPlatformUser(): Promise<PlatformUser | null> {
  const supabase = await createPlatformServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('email, name, primary_person_id')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    name: profile?.name ?? null,
    primaryPersonId: profile?.primary_person_id ?? null,
  }
}
