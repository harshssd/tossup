'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { requestToJoin, withdrawJoinRequest, type JoinRequestStatus } from '@/lib/platform/club-join-client'

interface Props {
  clubId: string
  slug: string
  signedIn: boolean
  isMember: boolean
  requestStatus: JoinRequestStatus | null
}

export function JoinClubButton({ clubId, slug, signedIn, isMember, requestStatus }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<JoinRequestStatus | null>(requestStatus)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (isMember) {
    return (
      <p className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#0f5a30]">
        <Check className="h-4 w-4" /> You&apos;re a member
      </p>
    )
  }

  if (status === 'PENDING') {
    return (
      <div className="mt-5 flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[#9a6b09]">
          <Clock className="h-4 w-4" /> Request pending
        </span>
        <button
          className="text-xs font-semibold text-[#9a978d] hover:text-[#16150f] disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await withdrawJoinRequest(clubId)
              setStatus(null)
              setOpen(false)
              toast.success('Request withdrawn')
            } catch (err) {
              toast.error((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          Withdraw
        </button>
      </div>
    )
  }

  if (!signedIn) {
    return (
      <Button
        size="sm"
        className="mt-5 gap-1 bg-[#1f9d57] text-white hover:bg-[#0f5a30]"
        onClick={() => router.push(`/account/sign-in?redirect=/club/${slug}`)}
      >
        <UserPlus className="h-4 w-4" /> Request to join
      </Button>
    )
  }

  if (!open) {
    return (
      <Button size="sm" className="mt-5 gap-1 bg-[#1f9d57] text-white hover:bg-[#0f5a30]" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> Request to join
      </Button>
    )
  }

  async function send() {
    setBusy(true)
    try {
      await requestToJoin(clubId, message)
      setStatus('PENDING')
      setOpen(false)
      toast.success('Request sent — an admin will review it')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-5 max-w-md space-y-2">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        aria-label="Message to the club (optional)"
        placeholder="Add a note for the club (optional) — e.g. your role, availability."
        rows={2}
        maxLength={1000}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} className="gap-1 bg-[#1f9d57] text-white hover:bg-[#0f5a30]" onClick={send}>
          <UserPlus className="h-4 w-4" /> {busy ? 'Sending…' : 'Send request'}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
