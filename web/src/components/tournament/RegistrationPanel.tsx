'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getMyRegistration, registerTeam } from '@/lib/platform/tournament-host'
import type { Registration } from '@/lib/platform/queries'

const STATUS_COPY: Record<string, { label: string; cls: string; note: string }> = {
  PENDING: { label: 'Pending review', cls: 'bg-[#fff3d6] text-[#7a5b00]', note: 'Your registration is waiting for the host to approve it.' },
  APPROVED: { label: 'Approved', cls: 'bg-[#dff3e4] text-[#0f5a30]', note: "You're in. Your team has been added to the tournament." },
  REJECTED: { label: 'Not accepted', cls: 'bg-[#f7dcdc] text-[#8a2a2a]', note: 'The host did not accept this registration.' },
}

export function RegistrationPanel({ leagueId, registrationStatus }: { leagueId: string; registrationStatus: string | null }) {
  const router = useRouter()
  const [state, setState] = useState<'checking' | 'guest' | 'ready'>('checking')
  const [mine, setMine] = useState<Registration | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyRegistration(leagueId)
      .then((reg) => {
        if (cancelled) return
        setMine(reg)
        setState('ready')
      })
      .catch(() => {
        // No session (or RLS) → treat as guest; the form prompts sign-in.
        if (!cancelled) setState('guest')
      })
    return () => {
      cancelled = true
    }
  }, [leagueId])

  if (registrationStatus !== 'OPEN') {
    return (
      <div className="cy-panel rounded-2xl p-5 text-sm text-[#6f6c63]">
        Registration is not open for this tournament.
      </div>
    )
  }

  if (state === 'checking') {
    return <div className="cy-panel rounded-2xl p-5 text-sm text-[#9a978d]">Loading…</div>
  }

  if (state === 'guest') {
    return (
      <div className="cy-panel rounded-2xl p-5">
        <h3 className="cy-display text-lg font-semibold text-[#16150f]">Register your team</h3>
        <p className="mt-1 text-sm text-[#6f6c63]">Sign in to enter your team into this tournament.</p>
        <Button
          className="mt-4 bg-[#1f9d57] text-white hover:bg-[#0f5a30]"
          onClick={() => router.push(`/account/sign-in?redirect=/tournaments/${leagueId}`)}
        >
          Sign in to register
        </Button>
      </div>
    )
  }

  if (mine) {
    const s = STATUS_COPY[mine.status] ?? STATUS_COPY.PENDING
    return (
      <div className="cy-panel rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="cy-display text-lg font-semibold text-[#16150f]">{mine.team_name}</h3>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${s.cls}`}>{s.label}</span>
        </div>
        <p className="mt-2 text-sm text-[#6f6c63]">{s.note}</p>
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const team_name = String(f.get('team_name') || '').trim()
    if (!team_name) return
    setSaving(true)
    try {
      await registerTeam({
        league_id: leagueId,
        team_name,
        contact_name: str(f, 'contact_name'),
        contact_email: str(f, 'contact_email'),
        contact_phone: str(f, 'contact_phone'),
        notes: str(f, 'notes'),
      })
      toast.success('Registration submitted')
      setMine(await getMyRegistration(leagueId))
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="cy-panel rounded-2xl p-5">
      <h3 className="cy-display text-lg font-semibold text-[#16150f]">Register your team</h3>
      <p className="mt-1 text-sm text-[#6f6c63]">Submit your team — the host reviews and approves entries.</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">
            Team name <span className="text-[#d64545]">*</span>
          </Label>
          <Input name="team_name" required placeholder="e.g. Midnight Strikers" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Captain / contact</Label>
            <Input name="contact_name" />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Phone</Label>
            <Input name="contact_phone" />
          </div>
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Email</Label>
          <Input name="contact_email" type="email" />
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Notes (optional)</Label>
          <Textarea name="notes" rows={2} />
        </div>
        <Button type="submit" disabled={saving} className="bg-[#1f9d57] text-white hover:bg-[#0f5a30]">
          {saving ? 'Submitting…' : 'Submit registration'}
        </Button>
      </form>
    </div>
  )
}

function str(f: FormData, k: string): string | null {
  const v = String(f.get(k) || '').trim()
  return v || null
}
