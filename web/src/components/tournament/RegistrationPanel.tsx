'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getMyAdminClubs, getMyRegistration, registerTeam, type MyAdminClub } from '@/lib/platform/tournament-host'
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
  const [adminClubs, setAdminClubs] = useState<MyAdminClub[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyRegistration(leagueId)
      .then((reg) => {
        if (cancelled) return
        setMine(reg)
        setState('ready')
        // Clubs the user administers → the "register as your club" picker. Only
        // a consented club link lets a verified honor reach that club's cabinet.
        getMyAdminClubs().then((clubs) => {
          if (!cancelled) setAdminClubs(clubs)
        })
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
      const club_id = String(f.get('club_id') || '').trim() || null
      await registerTeam({
        league_id: leagueId,
        team_name,
        contact_name: str(f, 'contact_name'),
        contact_email: str(f, 'contact_email'),
        contact_phone: str(f, 'contact_phone'),
        notes: str(f, 'notes'),
        club_id,
      })
      toast.success('Registration submitted')
      const reg = await getMyRegistration(leagueId)
      // If the read-back is somehow empty, re-enable the form rather than
      // leaving it stuck on "Submitting…".
      if (reg) setMine(reg)
      else setSaving(false)
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
        {adminClubs.length > 0 && (
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Register as club (optional)</Label>
            <select
              name="club_id"
              defaultValue=""
              className="h-9 w-full rounded-md border border-[#e7e4db] bg-[#f6f5f1] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f9d57]"
            >
              <option value="">Just my team — no club</option>
              {adminClubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[#9a978d]">
              Link this entry to your club so a win lands in its trophy cabinet.
            </p>
          </div>
        )}
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
