'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

// Auth-aware browser client for the platform project (tossup-cricket). Separate
// from `platformDb` (anon, session-less) — this one persists the user session in
// cookies. The cookie name is project-ref-scoped (`sb-<ref>-auth-token`), so it
// never collides with the legacy auction project's session.
export function createPlatformBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_ANON_KEY!
  )
}
