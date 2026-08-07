'use client'

import { createPlatformBrowserClient } from './auth-browser'

/** Force a reputation recompute now (instead of waiting for the nightly cron).
 *  Gated server-side to a caller who administers ≥1 club (request_reputation_recompute
 *  → not authorized otherwise). The recompute is idempotent + low-churn. */
export async function requestReputationRecompute(): Promise<void> {
  const supabase = createPlatformBrowserClient()
  const { error } = await supabase.rpc('request_reputation_recompute')
  if (error) throw new Error(error.message)
}
