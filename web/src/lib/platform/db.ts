import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Client for the consolidated platform DB (tossup-cricket). Anonymous + stateless,
// so the same instance is safe in server components and client components.
// Legacy auction features still use the default @/lib/supabase clients.
export const platformDb = createClient<Database>(
  process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_PLATFORM_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)
