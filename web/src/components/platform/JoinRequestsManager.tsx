'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, X, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { decideJoinRequest, loadJoinRequests, type JoinRequest } from '@/lib/platform/club-join-client'

/** Club admin surface: pending join requests with approve/reject. */
export function JoinRequestsManager({ clubId }: { clubId: string }) {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loaded, setLoaded] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setRequests(await loadJoinRequests(clubId))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoaded(true)
    }
  }, [clubId])

  useEffect(() => {
    load()
  }, [load])

  async function decide(req: JoinRequest, approve: boolean) {
    if (pendingId) return
    setPendingId(req.id)
    try {
      await decideJoinRequest(req.id, approve)
      // Drop it from the pending list; a reload would also work.
      setRequests((rs) => rs.filter((r) => r.id !== req.id))
      toast.success(approve ? `${req.requester_name} added to the club` : 'Request declined')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  if (loaded && requests.length === 0) {
    return <p className="mt-3 py-2 text-sm text-[#9a978d]">No pending join requests.</p>
  }

  return (
    <div className="mt-3 space-y-2.5">
      {requests.map((r) => (
        <div key={r.id} className="cy-panel flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#e7e4db] bg-white p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold text-[#16150f]">
              <UserPlus className="h-4 w-4 text-[#1f9d57]" /> {r.requester_name}
            </p>
            {r.message && <p className="mt-1 whitespace-pre-wrap text-sm text-[#3a382f]">{r.message}</p>}
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              disabled={pendingId === r.id}
              className="gap-1 bg-[#1f9d57] text-white hover:bg-[#0f5a30]"
              onClick={() => decide(r, true)}
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pendingId === r.id}
              aria-label={`Decline ${r.requester_name}`}
              onClick={() => decide(r, false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
