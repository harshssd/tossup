'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { requestReputationRecompute } from '@/lib/platform/reputation-client'

/** Admin "recompute now" — forces a reputation refresh instead of waiting for the
 *  nightly cron (e.g. right after adding a trophy). Server-gated to club admins. */
export function RecomputeReputationButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      await requestReputationRecompute()
      toast.success('Reputation refreshed')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={run} className="gap-1.5" aria-busy={busy}>
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
      {busy ? 'Refreshing…' : 'Recompute reputation'}
    </Button>
  )
}
