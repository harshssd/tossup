'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createOwnedTournament } from '@/lib/platform/tournament-host'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import { COUNTRIES } from '@/lib/platform/recognition'
import { PlatformShell } from '@/components/platform/PlatformShell'

const TYPES = ['TOURNAMENT', 'LEAGUE', 'SEASONAL', 'CHAMPIONSHIP']

export default function NewTournamentPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  // Hosting requires an account so the creator becomes the tournament's owner.
  const [authState, setAuthState] = useState<'checking' | 'guest' | 'ok'>('checking')

  useEffect(() => {
    let cancelled = false
    createPlatformBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setAuthState(data.user ? 'ok' : 'guest')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const name = String(f.get('name') || '').trim()
    if (!name) return
    setSaving(true)
    try {
      const t = await createOwnedTournament({
        name,
        type: String(f.get('type') || 'TOURNAMENT'),
        description: str(f, 'description'),
        country: str(f, 'country'),
        region: str(f, 'region'),
        city: str(f, 'city'),
        venue: str(f, 'venue'),
        format: str(f, 'format'),
        start_date: str(f, 'start_date'),
        end_date: str(f, 'end_date'),
        max_teams: f.get('max_teams') ? Number(f.get('max_teams')) : null,
        registration_status: String(f.get('registration_status') || 'UPCOMING'),
        points_win: num(f, 'points_win', 2),
        points_tie: num(f, 'points_tie', 1),
        points_loss: num(f, 'points_loss', 0),
        points_noresult: num(f, 'points_noresult', 1),
        rules_text: str(f, 'rules_text'),
      })
      toast.success('Tournament created')
      router.push(`/tournaments/${t.id}/manage`)
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  if (authState === 'checking') {
    return (
      <PlatformShell>
        <div className="px-4 py-16 text-center text-sm text-[#9a978d]">Loading…</div>
      </PlatformShell>
    )
  }
  if (authState === 'guest') {
    return (
      <PlatformShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="cy-display text-2xl font-semibold text-[#16150f]">Sign in to host</h1>
          <p className="mt-2 text-sm text-[#6f6c63]">
            Create an account so you become the tournament&apos;s owner and can manage teams, fixtures, and announcements.
          </p>
          <Button className="mt-5" onClick={() => router.push('/account/sign-in?redirect=/tournaments/new')}>
            Sign in
          </Button>
        </div>
      </PlatformShell>
    )
  }

  return (
    <PlatformShell>
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="cy-panel rounded-3xl p-6 sm:p-8">
      <h1 className="cy-display text-3xl font-semibold text-[#16150f] sm:text-4xl">Host a tournament</h1>
      <p className="mt-2 text-sm text-[#6f6c63]">
        Set it up here, then add teams, fixtures, and enter results. Standings compute automatically.
      </p>
      <div className="cy-seam mt-5 max-w-[10rem]" />
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Name" required>
          <Input name="name" required placeholder="e.g. Summer Sixes 2026" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select name="type">
              {TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
              ))}
            </Select>
          </Field>
          <Field label="Format">
            <Input name="format" placeholder="T20 / 6-a-side…" />
          </Field>
        </div>
        <Field label="About">
          <Textarea name="description" rows={2} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Country">
            <Select name="country">
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="State / region">
            <Input name="region" />
          </Field>
          <Field label="City">
            <Input name="city" />
          </Field>
        </div>
        <Field label="Venue">
          <Input name="venue" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Start date">
            <Input name="start_date" type="date" />
          </Field>
          <Field label="End date">
            <Input name="end_date" type="date" />
          </Field>
          <Field label="Max teams">
            <Input name="max_teams" type="number" />
          </Field>
        </div>
        <Field label="Registration">
          <Select name="registration_status">
            <option value="UPCOMING">Upcoming</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </Select>
        </Field>

        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Points (win / tie / loss / no-result)</Label>
          <div className="grid grid-cols-4 gap-2">
            <Input name="points_win" type="number" defaultValue={2} />
            <Input name="points_tie" type="number" defaultValue={1} />
            <Input name="points_loss" type="number" defaultValue={0} />
            <Input name="points_noresult" type="number" defaultValue={1} />
          </div>
        </div>
        <Field label="Rules (optional)">
          <Textarea name="rules_text" rows={2} />
        </Field>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Creating…' : 'Create tournament'}
        </Button>
      </form>
      </div>
    </div>
    </PlatformShell>
  )
}

function str(f: FormData, k: string): string | null {
  const v = String(f.get(k) || '').trim()
  return v || null
}
function num(f: FormData, k: string, dflt: number): number {
  const v = f.get(k)
  return v === null || v === '' ? dflt : Number(v)
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">
        {label} {required && <span className="text-[#d64545]">*</span>}
      </Label>
      {children}
    </div>
  )
}
function Select({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <select
      name={name}
      className="h-9 w-full rounded-md border border-[#e7e4db] bg-[#f6f5f1] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f9d57]"
    >
      {children}
    </select>
  )
}
