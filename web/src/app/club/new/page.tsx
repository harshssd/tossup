'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { createOwnedClub } from '@/lib/platform/club-admin'
import { createPlatformBrowserClient } from '@/lib/platform/auth-browser'
import { COUNTRIES, PLAYING_ROLES, roleLabel } from '@/lib/platform/recognition'
import { PlatformShell } from '@/components/platform/PlatformShell'

export default function NewClubPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [recruiting, setRecruiting] = useState(false)
  const [roles, setRoles] = useState<string[]>([])
  // Registering a club requires an account so the creator becomes its owner.
  const [authState, setAuthState] = useState<'checking' | 'guest' | 'ok'>('checking')

  useEffect(() => {
    let cancelled = false
    createPlatformBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setAuthState(data.user ? 'ok' : 'guest')
      })
      .catch(() => {
        if (!cancelled) setAuthState('guest')
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
      const club = await createOwnedClub({
        name,
        description: str(f, 'description'),
        country: str(f, 'country'),
        region: str(f, 'region'),
        city: str(f, 'city'),
        website: str(f, 'website'),
        contact_email: str(f, 'contact_email'),
        founded_year: f.get('founded_year') ? Number(f.get('founded_year')) : null,
        is_recruiting: recruiting,
        roles_needed: recruiting ? roles : [],
      })
      toast.success('Club created')
      router.push(`/club/${club.slug}`)
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
          <h1 className="cy-display text-2xl font-semibold text-[#16150f]">Sign in to register a club</h1>
          <p className="mt-2 text-sm text-[#6f6c63]">
            Create an account so you become the club&apos;s owner and can manage its roster.
          </p>
          <Button className="mt-5" onClick={() => router.push('/account/sign-in?redirect=/club/new')}>
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
      <h1 className="cy-display text-3xl font-semibold text-[#16150f] sm:text-4xl">Register a club</h1>
      <p className="mt-2 text-sm text-[#6f6c63]">
        New clubs start at the Community cap. Verification is earned later.
      </p>
      <div className="cy-seam mt-5 max-w-[10rem]" />
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Club name" required>
          <Input name="name" required placeholder="e.g. Sidewinders CC" />
        </Field>
        <Field label="About">
          <Textarea name="description" rows={3} placeholder="Who you are, where you play…" />
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
            <Input name="region" placeholder="e.g. Karnataka" />
          </Field>
          <Field label="City">
            <Input name="city" placeholder="e.g. Bengaluru" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Website">
            <Input name="website" type="url" placeholder="https://" />
          </Field>
          <Field label="Contact email">
            <Input name="contact_email" type="email" />
          </Field>
          <Field label="Founded">
            <Input name="founded_year" type="number" placeholder="2015" />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-md border border-[#e7e4db] p-3">
          <div>
            <p className="text-sm font-medium">Recruiting players</p>
            <p className="text-xs text-muted-foreground">Show up in discovery for players seeking a club.</p>
          </div>
          <Switch checked={recruiting} onCheckedChange={setRecruiting} />
        </div>
        {recruiting && (
          <div className="flex flex-wrap gap-2">
            {PLAYING_ROLES.map((r) => {
              const on = roles.includes(r)
              return (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRoles((s) => (on ? s.filter((x) => x !== r) : [...s, r]))}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    on ? 'border-[#1f9d57] bg-[#e7f4ec] text-[#0f5a30]' : 'border-[#e7e4db] text-muted-foreground'
                  }`}
                >
                  {roleLabel(r)}
                </button>
              )
            })}
          </div>
        )}

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Creating…' : 'Create club'}
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
